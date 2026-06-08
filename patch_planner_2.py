import os

def replace_in_file(filepath, old, new):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

router_path = r"apps\api\src\routes\content-planner.ts"
replace_in_file(router_path, "where: { id: req.params.id", "where: { id: req.params.id as string")
replace_in_file(router_path, "authorizeContentPlan(req.params.id, ", "authorizeContentPlan(req.params.id as string, ")

# Also fix the connection.service and post.service errors
# "Type 'unknown' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue'"
# This happens when setting metadata: data to a generic object.
replace_in_file(r"apps\api\src\services\connection.service.ts", "metadata: updateData.metadata,", "metadata: updateData.metadata as any,")
replace_in_file(r"apps\api\src\services\connection.service.ts", "metadata: data.metadata,", "metadata: data.metadata as any,")
replace_in_file(r"apps\api\src\services\conversation.service.ts", "metadata: data.metadata,", "metadata: data.metadata as any,")
replace_in_file(r"apps\api\src\services\conversation.service.ts", "metadata: updateData.metadata,", "metadata: updateData.metadata as any,")
replace_in_file(r"apps\api\src\services\post.service.ts", "platformMetadata: input.platformMetadata,", "platformMetadata: input.platformMetadata as any,")
replace_in_file(r"apps\api\src\services\post.service.ts", "platformMetadata: data.platformMetadata,", "platformMetadata: data.platformMetadata as any,")

