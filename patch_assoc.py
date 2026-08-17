import re

with open('src/pages/AssociationManagement.tsx', 'r') as f:
    content = f.read()

# Update selectDepartment
content = content.replace(
    "setSettings(dept.management_settings || {});",
    "setSettings(madrasah?.config_json?.departments_config?.[dept.id]?.management_settings || {});"
)

# Update selectedDept type check
content = content.replace(
    "!selectedDept.association_type",
    "!madrasah?.config_json?.departments_config?.[selectedDept.id]?.association_type"
)
content = content.replace(
    "selectedDept?.association_type ===",
    "madrasah?.config_json?.departments_config?.[selectedDept?.id || '']?.association_type ==="
)
content = content.replace(
    "selectedDept.association_type",
    "madrasah?.config_json?.departments_config?.[selectedDept.id]?.association_type"
)

# Update saveSettings
save_settings_new = """
  const saveSettings = async () => {
    if (!selectedDept || !madrasah) return;
    setSaving(true);
    try {
      const currentConfig = madrasah.config_json || {};
      const deptConfigs = currentConfig.departments_config || {};
      
      deptConfigs[selectedDept.id] = {
        ...(deptConfigs[selectedDept.id] || {}),
        management_settings: settings
      };
      
      const newConfig = { ...currentConfig, departments_config: deptConfigs };
      
      const { error } = await supabase
        .from('institutions')
        .update({ config_json: newConfig })
        .eq('id', madrasah.id);
        
      if (error) throw error;
      madrasah.config_json = newConfig; // mutate local state
      
      alert(lang === 'bn' ? 'সেটিংস সেভ হয়েছে!' : 'Settings saved successfully!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };
"""

content = re.sub(
    r"const saveSettings = async \(\) => \{[\s\S]*?finally \{\s*setSaving\(false\);\s*\}\s*\};",
    save_settings_new,
    content
)

with open('src/pages/AssociationManagement.tsx', 'w') as f:
    f.write(content)
