import re
import glob

files = glob.glob('src/pages/*.tsx')

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    if 'madrasah?.config_json' in content or 'madrasah.config_json' in content:
        print("Checking", file)
        
        # Exceptions where we mutate it or we already parse it
        if 'parsedConfig' in content and 'JSON.parse' in content:
            print("Already has parsedConfig", file)
            # We can still replace other occurrences if needed, but let's be careful.
            
