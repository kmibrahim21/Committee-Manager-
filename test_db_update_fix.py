with open('src/pages/Departments.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "await supabase.from('institutions').update({ config_json: newConfig }).eq('id', madrasah.id);",
    "const { error: configErr } = await supabase.from('institutions').update({ config_json: newConfig }).eq('id', madrasah.id);\n          if (configErr) console.error('Config update error:', configErr);"
)

with open('src/pages/Departments.tsx', 'w') as f:
    f.write(content)
