import sys
import re

def patch_applayout():
    path = '/home/jbliss/sites/smmt/apps/web/src/components/layout/AppLayout.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'WorkspaceSwitcher' in content:
        print('AppLayout.tsx already patched')
        return

    # Add import
    content = content.replace("import { Avatar } from '@/components/ui';", "import { Avatar } from '@/components/ui';\nimport { WorkspaceSwitcher } from './WorkspaceSwitcher';")

    # Add component
    target = '<div className="flex items-center gap-2">'
    replacement = target + '\n            <WorkspaceSwitcher />'
    content = content.replace(target, replacement)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Patched AppLayout.tsx')

patch_applayout()
