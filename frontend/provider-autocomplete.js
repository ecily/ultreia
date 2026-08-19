(function attachProviderAutocomplete(global) {
  function createProviderAutocompleteController({ delayMs = 250, minLength = 3, fetchSuggestions, onResults, onError }) {
    let timer = null;
    let sequence = 0;
    let activeController = null;
    const sessionToken = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

    const cancel = () => {
      sequence += 1;
      global.clearTimeout(timer);
      timer = null;
      activeController?.abort();
      activeController = null;
    };

    const schedule = (rawInput, locale) => {
      const input = String(rawInput || '').trim();
      cancel();
      if (input.length < minLength) {
        onResults([]);
        return;
      }
      const requestSequence = sequence;
      timer = global.setTimeout(async () => {
        const controller = new global.AbortController();
        activeController = controller;
        try {
          const result = await fetchSuggestions({ input, locale, sessionToken, signal: controller.signal });
          if (requestSequence !== sequence) return;
          onResults(result || []);
        } catch (error) {
          if (error?.name === 'AbortError' || requestSequence !== sequence) return;
          onError(error);
        } finally {
          if (requestSequence === sequence) activeController = null;
        }
      }, delayMs);
    };

    return { cancel, schedule, sessionToken };
  }

  global.UltreiaProviderAutocomplete = { create: createProviderAutocompleteController };
}(window));
