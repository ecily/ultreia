import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Pencil, Plus, Trash2 } from "lucide-react";

import axiosInstance from "../api/axios";
import AdminNav from "../components/AdminNav";

const AdminCategoryPage = () => {
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState("");
  const [subcatInput, setSubcatInput] = useState({});
  const [editingSubcat, setEditingSubcat] = useState(null);
  const [error, setError] = useState("");

  const fetchCategories = async () => {
    try {
      const res = await axiosInstance.get("/categories");
      setCategories(res.data);
    } catch {
      setError("Fehler beim Laden der Kategorien");
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const createCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await axiosInstance.post("/categories", { name: newCatName.trim() });
      setNewCatName("");
      fetchCategories();
    } catch {
      setError("Fehler beim Erstellen");
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm("Kategorie wirklich löschen?")) return;
    await axiosInstance.delete(`/categories/${id}`);
    fetchCategories();
  };

  const addSubcategory = async (id) => {
    const cat = categories.find((c) => c._id === id);
    const sub = subcatInput[id]?.trim();
    if (!sub) return;
    const updated = [...cat.subcategories, sub];
    await axiosInstance.put(`/categories/${id}`, { name: cat.name, subcategories: updated });
    setSubcatInput((prev) => ({ ...prev, [id]: "" }));
    fetchCategories();
  };

  const deleteSubcategory = async (catId, sub) => {
    const cat = categories.find((c) => c._id === catId);
    const updated = cat.subcategories.filter((s) => s !== sub);
    await axiosInstance.put(`/categories/${catId}`, { name: cat.name, subcategories: updated });
    fetchCategories();
  };

  const startEditingSub = (catId, sub) => {
    setEditingSubcat({ catId, oldName: sub, value: sub });
  };

  const cancelEditingSub = () => {
    setEditingSubcat(null);
  };

  const saveEditingSub = async () => {
    const { catId, oldName, value } = editingSubcat;
    if (!value.trim()) return;
    const cat = categories.find((c) => c._id === catId);
    const updated = cat.subcategories.map((s) => (s === oldName ? value.trim() : s));
    await axiosInstance.put(`/categories/${catId}`, { name: cat.name, subcategories: updated });
    setEditingSubcat(null);
    fetchCategories();
  };

  const onDragEnd = async (result, catId) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    const cat = categories.find((c) => c._id === catId);
    const reordered = Array.from(cat.subcategories);
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(destIndex, 0, moved);
    await axiosInstance.put(`/categories/${catId}`, { name: cat.name, subcategories: reordered });
    fetchCategories();
  };

  return (
    <div className="sm-page">
      <div className="sm-stack">
        <AdminNav />

        <div className="sm-shell py-8 sm:py-10">
          <div className="mx-auto w-full max-w-4xl space-y-5">
            <section className="sm-card-soft p-6 sm:p-8">
              <h1 className="text-3xl font-extrabold">Kategorien verwalten</h1>
              <p className="mt-2 text-slate-600">Lege Hauptkategorien und Subkategorien an, ordne sie per Drag & Drop und halte die Taxonomie konsistent.</p>

              {error && <p className="sm-error mt-4">{error}</p>}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  placeholder="Neue Kategorie"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="sm-input"
                />
                <button onClick={createCategory} className="sm-btn-primary !px-4 !py-2">
                  <Plus size={15} /> Hinzufügen
                </button>
              </div>
            </section>

            {categories.map((cat) => (
              <section key={cat._id} className="sm-card p-5 sm:p-6">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-xl font-bold">{cat.name}</h2>
                  <button onClick={() => deleteCategory(cat._id)} className="sm-btn-danger !px-3 !py-2">
                    <Trash2 size={14} /> Löschen
                  </button>
                </div>

                <DragDropContext onDragEnd={(result) => onDragEnd(result, cat._id)}>
                  <Droppable droppableId={cat._id}>
                    {(provided) => (
                      <ul {...provided.droppableProps} ref={provided.innerRef} className="grid gap-2">
                        {cat.subcategories.map((sub, index) => {
                          const isEditing = editingSubcat?.catId === cat._id && editingSubcat?.oldName === sub;
                          return (
                            <Draggable key={sub} draggableId={sub} index={index}>
                              {(dragProvided) => (
                                <li
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                                >
                                  {isEditing ? (
                                    <>
                                      <input
                                        type="text"
                                        value={editingSubcat.value}
                                        onChange={(e) => setEditingSubcat((prev) => ({ ...prev, value: e.target.value }))}
                                        className="sm-input !h-9"
                                      />
                                      <button onClick={saveEditingSub} className="sm-btn-primary !px-3 !py-2">Speichern</button>
                                      <button onClick={cancelEditingSub} className="sm-btn-secondary !px-3 !py-2">Abbrechen</button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="flex-1 text-sm text-slate-700">{sub}</span>
                                      <button onClick={() => startEditingSub(cat._id, sub)} className="sm-btn-secondary !px-3 !py-2">
                                        <Pencil size={14} /> Bearbeiten
                                      </button>
                                      <button onClick={() => deleteSubcategory(cat._id, sub)} className="sm-btn-danger !px-3 !py-2">
                                        <Trash2 size={14} /> Entfernen
                                      </button>
                                    </>
                                  )}
                                </li>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </ul>
                    )}
                  </Droppable>
                </DragDropContext>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    placeholder="Neue Subkategorie"
                    value={subcatInput[cat._id] || ""}
                    onChange={(e) => setSubcatInput((prev) => ({ ...prev, [cat._id]: e.target.value }))}
                    className="sm-input"
                  />
                  <button onClick={() => addSubcategory(cat._id)} className="sm-btn-primary !px-4 !py-2">
                    <Plus size={15} /> Hinzufügen
                  </button>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCategoryPage;
