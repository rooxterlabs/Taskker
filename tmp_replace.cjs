const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// Add global event listener
code = code.replace(
  'setIsAuthLoading(false);\n        });\n\n        const {',
  'setIsAuthLoading(false);\n        });\n\n        const handleOpenAdminSettingsEvent = (e) => openAdminSettings(e.detail);\n        window.addEventListener("openAdminSettings", handleOpenAdminSettingsEvent);\n\n        const {'
);

code = code.replace(
  'return () => subscription.unsubscribe();\n    }, []);',
  'return () => {\n            subscription.unsubscribe();\n            window.removeEventListener("openAdminSettings", handleOpenAdminSettingsEvent);\n        };\n    }, []);'
);

// Add userRole to CategoryDropdown instances
code = code.replace(/<CategoryDropdown(\s+value=\{)/g, '<CategoryDropdown\n                    userRole={userRole}$1');

// modify CategoryDropdown definition
const cdDef = `function CategoryDropdown({ categories, value, onSelect, onAdd, onDelete, readOnly, userRole }) {`;
code = code.replace(/function CategoryDropdown\(\{ categories, value, onSelect, onAdd, onDelete, readOnly \}\) \{/g, cdDef);

// modify trash can
const trashOld = `onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                                    className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-white transition-all ml-2"`;
const trashNew = `onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                                    className={\`opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-white transition-all ml-2 \${c.created_by ? 'block' : 'hidden'}\`}`;
code = code.replace(trashOld, trashNew);

// modify handleAdd logic to prevent non-worker creation in dropdown
const createBtnOld = `<button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsCreating(true); }}`;
const createBtnNew = `<button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (userRole === 'admin' || userRole === 'super_admin') {
                                    setIsOpen(false);
                                    window.dispatchEvent(new CustomEvent('openAdminSettings', { detail: 'Project Management' }));
                                } else {
                                    setIsCreating(true);
                                }
                            }}`;
code = code.replace(createBtnOld, createBtnNew);

fs.writeFileSync('src/App.jsx', code);
console.log('App.jsx replacements completed!');
