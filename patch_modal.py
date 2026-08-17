with open('src/pages/Departments.tsx', 'r') as f:
    content = f.read()

# For add button
target_add = "onClick={() => { setNewClassName(''); setNewSortOrder(''); setEditingClass(null); setShowModal(true); }}"
replace_add = "onClick={() => { setNewClassName(''); setNewSortOrder(''); setNewAssociationType(''); setEditingClass(null); setShowModal(true); }}"

content = content.replace(target_add, replace_add)

# For edit button
target_edit = "onClick={(e) => { e.stopPropagation(); setNewClassName(cls.name); setNewSortOrder(cls.sort_order?.toString() || ''); setEditingClass(cls); setShowModal(true); }}"
replace_edit = "onClick={(e) => { e.stopPropagation(); setNewClassName(cls.name); setNewSortOrder(cls.sort_order?.toString() || ''); setNewAssociationType(madrasah?.config_json?.departments_config?.[cls.id]?.association_type || ''); setEditingClass(cls); setShowModal(true); }}"

content = content.replace(target_edit, replace_edit)

with open('src/pages/Departments.tsx', 'w') as f:
    f.write(content)
print("Updated modal clicks!")
