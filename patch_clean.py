import os
import re

def rewrite(filepath, old, new):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# Add contentPlanner to api.ts properly
api_path = r"apps\web\src\lib\api.ts"
with open(api_path, 'r', encoding='utf-8') as f:
    api_content = f.read()

if "contentPlanner: {" not in api_content:
    addition = """
  contentPlanner: {
    generate: (data: any) => request<any>('/content-planner/generate', { method: 'POST', body: JSON.stringify(data) }),
    getPlan: (planId: string) => request<any>(`/content-planner/plan/${planId}`),
    listPlans: () => request<any>('/content-planner/plans'),
    editPost: (postId: string, data: any) => request<any>(`/content-planner/post/${postId}`, { method: 'PUT', body: JSON.stringify(data) }),
    regeneratePost: (postId: string) => request<any>(`/content-planner/post/${postId}/regenerate`, { method: 'POST' }),
    deletePost: (postId: string) => request<any>(`/content-planner/post/${postId}`, { method: 'DELETE' }),
    cancelPlan: (planId: string) => request<any>(`/content-planner/plan/${planId}/cancel`, { method: 'POST' }),
    authorizePlan: (planId: string) => request<any>(`/content-planner/plan/${planId}/authorize`, { method: 'POST' }),
    uploadMedia: (postId: string, formData: FormData) => request<any>(`/content-planner/post/${postId}/upload-media`, { method: 'POST', body: formData }),
    saveDesign: (postId: string, data: any) => request<any>(`/content-planner/post/${postId}/save-design`, { method: 'POST', body: JSON.stringify(data) }),
  },
"""
    api_content = api_content.replace("export const api = {", "export const api = {" + addition)
    with open(api_path, 'w', encoding='utf-8') as f:
        f.write(api_content)


planner_path = r"apps\web\src\pages\ContentPlannerPage.tsx"
with open(planner_path, 'r', encoding='utf-8') as f:
    p_content = f.read()

# Replace all the broken api.request calls
p_content = re.sub(r"const res = await api\.post\('.*?/content-planner/generate', \{ prompt, platforms \}\);", "const res = await api.contentPlanner.generate({ prompt, platforms });", p_content)

p_content = re.sub(r"const res = await api\.request\(`.*?/plan/\$\{planId\}`\);\s*return res\.data;", "const res = await api.contentPlanner.getPlan(planId);\n      return res;", p_content)

p_content = re.sub(r"const res = await api\.request\(`.*?/plan/\$\{planId\}/authorize`\);\s*return res\.data;", "const res = await api.contentPlanner.authorizePlan(planId);\n      return res;", p_content)

p_content = re.sub(r"const res = await api\.request\(`.*?/post/\$\{post\.id\}/regenerate`\);\s*return res\.data;", "const res = await api.contentPlanner.regeneratePost(post.id);\n      return res;", p_content)

p_content = re.sub(r"const res = await api\.request\(`.*?/post/\$\{post\.id\}`,\s*\{\s*contentBody:\s*content\s*\}\);\s*return res\.data;", "const res = await api.contentPlanner.editPost(post.id, { contentBody: content });\n      return res;", p_content)

p_content = re.sub(r"const res = await api\.request\(`.*?/post/\$\{post\.id\}`\);\s*return res\.data;", "const res = await api.contentPlanner.deletePost(post.id);\n      return res;", p_content)

p_content = re.sub(r"await api\.request\(`.*?/post/\$\{post\.id\}/upload-media`,\s*formData.*?\)\s*\}", "await api.contentPlanner.uploadMedia(post.id, formData);\n      }", p_content, flags=re.DOTALL)

p_content = re.sub(r"const res = await api\.request\('.*?/plans'\);\s*return res\.data;", "const res = await api.contentPlanner.listPlans();\n      return res;", p_content)

p_content = p_content.replace("return res.data;", "return res;")
p_content = p_content.replace("api.post('/api/v1/content-planner/generate", "api.contentPlanner.generate")

with open(planner_path, 'w', encoding='utf-8') as f:
    f.write(p_content)

editor_path = r"apps\web\src\pages\EditorPage.tsx"
with open(editor_path, 'r', encoding='utf-8') as f:
    e_content = f.read()

e_content = re.sub(r"await api\.request\(`.*?/post/\$\{contentPlanPostId\}/save-design`.*?\)\s*\)", "await api.contentPlanner.saveDesign(contentPlanPostId, { mediaUrl: blobUrl, designData: json })", e_content)
e_content = re.sub(r"await api\.request\(`.*?/post/\$\{contentPlanPostId\}/upload-media`.*?\)\s*\)", "await api.contentPlanner.uploadMedia(contentPlanPostId, formData)", e_content)

# Just in case there are missing parentheses from regex mistakes
e_content = e_content.replace(", { method: 'POST', body: JSON.stringify({ mediaUrl: blobUrl, designData: json }) })", "")
e_content = e_content.replace(", { method: 'POST', body: formData }", "")

with open(editor_path, 'w', encoding='utf-8') as f:
    f.write(e_content)

