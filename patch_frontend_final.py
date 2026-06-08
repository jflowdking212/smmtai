import os

planner_path = r"apps\web\src\pages\ContentPlannerPage.tsx"
with open(planner_path, 'r', encoding='utf-8') as f:
    content = f.read()

# exact string replacements based on origin/main
content = content.replace("await api.post(`/api/v1/content-planner/plan/${planId}/authorize`);", "await api.contentPlanner.authorizePlan(planId);")
content = content.replace("await api.post(`/api/v1/content-planner/post/${post.id}/regenerate`);", "await api.contentPlanner.regeneratePost(post.id);")
content = content.replace("await api.put(`/api/v1/content-planner/post/${post.id}`, { contentBody: content });", "await api.contentPlanner.editPost(post.id, { contentBody: content });")
content = content.replace("await api.delete(`/api/v1/content-planner/post/${post.id}`);", "await api.contentPlanner.deletePost(post.id);")
content = content.replace("await api.get('/api/v1/content-planner/plans');", "await api.contentPlanner.listPlans();")
content = content.replace("await api.get(`/api/v1/content-planner/plan/${planId}`);", "await api.contentPlanner.getPlan(planId);")

content = content.replace("await api.post(`/api/v1/content-planner/post/${post.id}/upload-media`, formData, {", "await api.contentPlanner.uploadMedia(post.id, formData);")
content = content.replace("headers: { 'Content-Type': 'multipart/form-data' }", "")
content = content.replace("    })", "")

content = content.replace('variant="outline"', 'variant="secondary"')
content = content.replace('size="icon"', 'size="sm"')

with open(planner_path, 'w', encoding='utf-8') as f:
    f.write(content)

editor_path = r"apps\web\src\pages\EditorPage.tsx"
with open(editor_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("await api.post(`/api/v1/content-planner/post/${contentPlanPostId}/save-design`, { mediaUrl: blobUrl, designData: json })", "await api.contentPlanner.saveDesign(contentPlanPostId, { mediaUrl: blobUrl, designData: json })")
content = content.replace("await api.post(`/api/v1/content-planner/post/${contentPlanPostId}/upload-media`, formData, {", "await api.contentPlanner.uploadMedia(contentPlanPostId, formData);")
content = content.replace("headers: { 'Content-Type': 'multipart/form-data' }", "")
content = content.replace("        })", "")

with open(editor_path, 'w', encoding='utf-8') as f:
    f.write(content)
