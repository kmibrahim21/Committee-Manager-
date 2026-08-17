import re

with open('src/pages/Departments.tsx', 'r') as f:
    content = f.read()

# Revert the inserts to Departments table
content = content.replace("association_type: newAssociationType || null", "")
content = content.replace(",\n            \n        };", "\n        };")
content = content.replace(",\n            \n", "\n")

# We will handle saving it to madrasah.config_json inside handleSaveClass
# We can just let it insert/update the department first, then update institution config
content = re.sub(
    r"(const order = newSortOrder \? parseInt\(newSortOrder\) : null;)",
    r"\1\n    let deptId = editingClass?.id;",
    content
)

# After inserting new department, we get its ID
content = re.sub(
    r"const \{ error \} = await supabase\.from\('departments'\)\.insert\(payload\);",
    r"const { data: newDept, error } = await supabase.from('departments').insert(payload).select().single();\n          if (newDept) deptId = newDept.id;",
    content
)

# Update config_json at the end of the try block
config_update = """
      if (deptId && newAssociationType !== undefined) {
        const currentConfig = madrasah.config_json || {};
        const deptConfigs = currentConfig.departments_config || {};
        deptConfigs[deptId] = {
          ...deptConfigs[deptId],
          association_type: newAssociationType || null
        };
        const newConfig = { ...currentConfig, departments_config: deptConfigs };
        if (navigator.onLine) {
          await supabase.from('institutions').update({ config_json: newConfig }).eq('id', madrasah.id);
          // Mutate local state so UI reflects
          madrasah.config_json = newConfig;
        }
      }
"""

content = re.sub(
    r"(setShowModal\(false\);)",
    config_update + r"\n      \1",
    content
)

# Populate newAssociationType when editing
content = re.sub(
    r"setNewAssociationType\(cls\.association_type \|\| ''\);",
    r"setNewAssociationType(madrasah?.config_json?.departments_config?.[cls.id]?.association_type || '');",
    content
)

with open('src/pages/Departments.tsx', 'w') as f:
    f.write(content)
