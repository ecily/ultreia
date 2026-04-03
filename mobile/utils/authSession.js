import AsyncStorage from '@react-native-async-storage/async-storage';

function normalize(value) {
  return String(value || '').trim();
}

function computeDisplayName(user) {
  const firstName = normalize(user?.firstName);
  const lastName = normalize(user?.lastName);
  const username = normalize(user?.username);
  const legacyName = normalize(user?.name);

  if (firstName && lastName) return `${firstName} ${lastName}`.trim();
  if (username) return username;
  if (legacyName) return legacyName;
  return '';
}

export async function persistAuthSession({ token, user }) {
  const safeUser = user || {};
  const interests = Array.isArray(safeUser.interests) ? safeUser.interests : [];
  const firstName = normalize(safeUser.firstName) || normalize(computeDisplayName(safeUser).split(' ')[0]);
  // Backward-compatible: only explicit false is treated as unverified.
  const emailVerified = safeUser?.emailVerified !== false;
  const profile = {
    _id: safeUser._id,
    name: normalize(safeUser.name) || computeDisplayName(safeUser),
    firstName: normalize(safeUser.firstName),
    lastName: normalize(safeUser.lastName),
    username: normalize(safeUser.username),
    email: normalize(safeUser.email),
    emailVerified,
    interests,
    preferredRadius: safeUser.preferredRadius,
  };

  const pairs = [
    ['userId', normalize(safeUser._id)],
    ['userInterests', JSON.stringify(interests)],
    ['userInterests.csv', interests.map((s) => normalize(s)).filter(Boolean).join(',')],
    ['userProfile', JSON.stringify(profile)],
    ['userFirstName', firstName],
    ['userEmail', profile.email],
    ['userEmailVerified', emailVerified ? '1' : '0'],
  ];

  if (token) pairs.push(['token', String(token)]);

  await AsyncStorage.multiSet(pairs);
}

export async function persistVerifiedUser(user) {
  await persistAuthSession({ token: null, user });
}
