import os

def replace_in_file(filepath, old, new):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    if old in content:
        content = content.replace(old, new)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

# Fix api.ts to expose request or contentPlanner
api_path = r"apps\web\src\lib\api.ts"
replace_in_file(api_path, "export const api = {", "export const api = {\n  request: <T>(url: string, options?: RequestInit) => request<T>(url, options),")

# Fix index.tsx to add CardHeader, CardTitle, CardContent, CardFooter
ui_additions = """
export function CardHeader({ className, children }: any) { return <div className={cn('p-6 pb-0', className)}>{children}</div>; }
export function CardTitle({ className, children }: any) { return <h3 className={cn('font-semibold leading-none tracking-tight', className)}>{children}</h3>; }
export function CardContent({ className, children }: any) { return <div className={cn('p-6', className)}>{children}</div>; }
export function CardFooter({ className, children }: any) { return <div className={cn('flex items-center p-6 pt-0', className)}>{children}</div>; }
"""
ui_path = r"apps\web\src\components\ui\index.tsx"
with open(ui_path, 'a', encoding='utf-8') as f:
    f.write(ui_additions)

# Fix ContentPlannerPage.tsx
planner_path = r"apps\web\src\pages\ContentPlannerPage.tsx"
replace_in_file(planner_path, "await api.post(`/api/v1", "await api.request(`/content-planner")
replace_in_file(planner_path, "await api.put(`/api/v1", "await api.request(`/content-planner")
replace_in_file(planner_path, "await api.delete(`/api/v1", "await api.request(`/content-planner")
replace_in_file(planner_path, "await api.get('/api/v1", "await api.request('/content-planner")

replace_in_file(planner_path, "await api.post(`/content-planner", "await api.request(`/content-planner")
replace_in_file(planner_path, "await api.put(`/content-planner", "await api.request(`/content-planner")
replace_in_file(planner_path, "await api.delete(`/content-planner", "await api.request(`/content-planner")
replace_in_file(planner_path, "await api.get(`/content-planner", "await api.request(`/content-planner")

# Fix the method calls in ContentPlannerPage:
# const res = await api.request(`/content-planner/post/${post.id}/regenerate`, { method: 'POST' })
import re
with open(planner_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'api\.post\(`(/api/v1/content-planner/[^`]+)`\)', r"api.request(`\1`, { method: 'POST' })", content)
content = re.sub(r'api\.put\(`(/api/v1/content-planner/[^`]+)`, (.*?)\)', r"api.request(`\1`, { method: 'PUT', body: JSON.stringify(\2) })", content)
content = re.sub(r'api\.delete\(`(/api/v1/content-planner/[^`]+)`\)', r"api.request(`\1`, { method: 'DELETE' })", content)
content = re.sub(r'api\.get\((.*?)\)', r"api.request(\1)", content)

content = re.sub(r'api\.post\(`(/content-planner/[^`]+)`\)', r"api.request(`\1`, { method: 'POST' })", content)
content = re.sub(r'api\.put\(`(/content-planner/[^`]+)`, (.*?)\)', r"api.request(`\1`, { method: 'PUT', body: JSON.stringify(\2) })", content)
content = re.sub(r'api\.delete\(`(/content-planner/[^`]+)`\)', r"api.request(`\1`, { method: 'DELETE' })", content)
content = re.sub(r'api\.request\(`/content-planner/post/\$\{post\.id\}/upload-media`, formData, \{\s*headers:\s*\{\s*\'Content-Type\':\s*\'multipart/form-data\'\s*\}\s*\}\)', 
                 r"api.request(`/content-planner/post/${post.id}/upload-media`, { method: 'POST', body: formData })", content)

content = content.replace('variant="outline"', 'variant="secondary"')
content = content.replace('size="icon"', 'size="sm"')

with open(planner_path, 'w', encoding='utf-8') as f:
    f.write(content)

# Fix EditorPage.tsx
editor_path = r"apps\web\src\pages\EditorPage.tsx"
replace_in_file(editor_path, 
                "await api.post(`/api/v1/content-planner/post/${contentPlanPostId}/save-design`, { mediaUrl: blobUrl, designData: json })", 
                "await api.request(`/content-planner/post/${contentPlanPostId}/save-design`, { method: 'POST', body: JSON.stringify({ mediaUrl: blobUrl, designData: json }) })")
replace_in_file(editor_path, 
                "await api.post(`/api/v1/content-planner/post/${contentPlanPostId}/upload-media`", 
                "await api.request(`/content-planner/post/${contentPlanPostId}/upload-media`, { method: 'POST', body: formData }")
