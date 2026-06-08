import os

def replace_in_file(filepath, old, new):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# 1. authorization.service.ts
auth_path = r"apps\api\src\modules\content-planner\authorization.service.ts"
replace_in_file(auth_path, "import { prisma } from '@ee-postmind/db';", "import { prisma } from '../../config/database.js';\nimport { postService } from '../../services/post.service.js';")
replace_in_file(auth_path, "import { createPost } from '../../services/post.service';", "")

# replace createPost usage
old_create_post = """const newPost = await createPost({
        workspaceId,
        authorId,
        content: planPost.contentBody,
        platforms: [planPost.platform],
        status: 'scheduled',
        scheduledAt: planPost.scheduledAt,
        mediaUrls: planPost.mediaUrls,
        designData: planPost.editorDesignData ? JSON.stringify(planPost.editorDesignData) : undefined
      });"""

new_create_post = """const connection = await prisma.socialConnection.findFirst({
        where: { workspaceId, platform: planPost.platform, isConnected: true }
      });
      if (!connection) throw new Error(`No active connection found for ${planPost.platform}`);

      const newPost = await postService.createPost({
        workspaceId,
        userId: authorId,
        content: planPost.contentBody,
        platforms: [{ connectionId: connection.id, platform: planPost.platform as any }],
        scheduledAt: planPost.scheduledAt ? new Date(planPost.scheduledAt) : undefined,
        mediaUrls: planPost.mediaUrls
      } as any);"""
replace_in_file(auth_path, old_create_post, new_create_post)

# 2. planGuard.ts
guard_path = r"apps\api\src\modules\content-planner\planGuard.ts"
replace_in_file(guard_path, "import { prisma } from '@ee-postmind/db';", "import { prisma } from '../../config/database.js';\nimport { AuthRequest } from '../../middleware/auth.js';")
replace_in_file(guard_path, "(req: Request,", "(req: AuthRequest,")
replace_in_file(guard_path, "req.user?.workspaceId", "req.workspaceId")

# 3. content-planner.ts
router_path = r"apps\api\src\routes\content-planner.ts"
replace_in_file(router_path, "import { prisma } from '@ee-postmind/db';", "import { prisma } from '../config/database.js';")
replace_in_file(router_path, "req.user!.workspaceId", "req.workspaceId!")
replace_in_file(router_path, "req.user?.workspaceId", "req.workspaceId!")
replace_in_file(router_path, "req.user!.id", "req.userId!")
replace_in_file(router_path, "req.user?.id", "req.userId!")
replace_in_file(router_path, "import '../../services/openai.service.js'", "import { chatCompletion } from '../services/openai.service.js'")
replace_in_file(router_path, "const { chatCompletion } = await import('../../services/openai.service.js');", "const { chatCompletion } = await import('../services/openai.service.js');")

# 4. other service files
replace_in_file(r"apps\api\src\modules\content-planner\content-generator.service.ts", "import { prisma } from '@ee-postmind/db';", "import { prisma } from '../../config/database.js';")
replace_in_file(r"apps\api\src\modules\content-planner\plan-parser.service.ts", "import { prisma } from '@ee-postmind/db';", "import { prisma } from '../../config/database.js';")
replace_in_file(r"apps\api\src\modules\content-planner\schedule-composer.service.ts", "import { prisma } from '@ee-postmind/db';", "import { prisma } from '../../config/database.js';")
