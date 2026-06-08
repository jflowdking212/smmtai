import os

def replace_in_file(filepath, old, new):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# 1. planGuard.ts
guard_path = r"apps\api\src\modules\content-planner\planGuard.ts"
replace_in_file(guard_path, """      let allowedStep = 0;
      if (limits.features?.contentPlannerStep3) allowedStep = 3;
      else if (limits.features?.contentPlannerStep2) allowedStep = 2;
      else if (limits.features?.contentPlannerStep1) allowedStep = 1;""", """      let allowedStep = 1;
      const subscription = await prisma.subscription.findUnique({
        where: { workspaceId },
        select: { tier: true }
      });
      const tier = subscription?.tier || 'basic';
      if (tier === 'enterprise') allowedStep = 3;
      else if (tier === 'business' || tier === 'pro') allowedStep = 2;
      else allowedStep = 1;""")
replace_in_file(guard_path, """      const subscription = await prisma.subscription.findUnique({
        where: { workspaceId },
        select: { tier: true }
      });
      const tier = subscription?.tier || 'basic';""", "") # Remove duplicate tier fetch since I added it above

# 2. content-planner.ts
route_path = r"apps\api\src\routes\content-planner.ts"
replace_in_file(route_path, "const url = await uploadPublicFile(objectKey, file.buffer, file.mimetype);", """const result = await uploadPublicFile({
        buffer: file.buffer,
        key: objectKey,
        contentType: file.mimetype,
        baseUrl: process.env.PUBLIC_URL || 'http://localhost:3000',
        localUploadDir: process.env.UPLOAD_DIR || './uploads'
      });
      const url = result.url;""")

# 3. connection.service.ts
conn_path = r"apps\api\src\services\connection.service.ts"
replace_in_file(conn_path, "metadata: updateData.metadata as any,", "metadata: updateData.metadata ? JSON.parse(JSON.stringify(updateData.metadata)) : undefined,")
replace_in_file(conn_path, "metadata: data.metadata as any,", "metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,")

# 4. conversation.service.ts
conv_path = r"apps\api\src\services\conversation.service.ts"
replace_in_file(conv_path, "metadata: data.metadata as any,", "metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,")
replace_in_file(conv_path, "metadata: updateData.metadata as any,", "metadata: updateData.metadata ? JSON.parse(JSON.stringify(updateData.metadata)) : undefined,")

# 5. post.service.ts
post_path = r"apps\api\src\services\post.service.ts"
replace_in_file(post_path, "platformMetadata: input.platformMetadata as any,", "platformMetadata: input.platformMetadata ? JSON.parse(JSON.stringify(input.platformMetadata)) : undefined,")
replace_in_file(post_path, "platformMetadata: data.platformMetadata as any,", "platformMetadata: data.platformMetadata ? JSON.parse(JSON.stringify(data.platformMetadata)) : undefined,")

# 6. authorization.service.ts
auth_path = r"apps\api\src\modules\content-planner\authorization.service.ts"
replace_in_file(auth_path, "where: { workspaceId, platform: planPost.platform, isConnected: true }", "where: { workspaceId, platform: planPost.platform, isActive: true }")

