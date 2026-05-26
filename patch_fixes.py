import sys
import re

def patch_schema():
    path = '/home/jbliss/sites/smmt/packages/db/prisma/schema.prisma'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if '@@index([postId])' not in content:
        content = content.replace('@@map("media")', '@@index([postId])\n  @@map("media")')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Patched schema.prisma')
    else:
        print('schema.prisma already patched')

def patch_authstore():
    path = '/home/jbliss/sites/smmt/apps/web/src/stores/authStore.ts'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'localStorage.getItem' not in content:
        content = content.replace('sessionStorage.getItem', 'localStorage.getItem')
        content = content.replace('sessionStorage.setItem', 'localStorage.setItem')
        content = content.replace('sessionStorage.removeItem', 'localStorage.removeItem')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Patched authStore.ts')
    else:
        print('authStore.ts already patched')

patch_schema()
patch_authstore()
