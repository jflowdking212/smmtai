import { prisma } from '../config/database.js';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export type ToolHandler = (args: any, context: { userId: string; workspaceId: string; role: string }) => Promise<string | Record<string, any>>;

// ----------------------------------------
// Admin Tools (role: owner or admin)
// ----------------------------------------

export const adminTools: Record<string, { definition: ToolDefinition; handler: ToolHandler }> = {
  get_active_users: {
    definition: {
      type: 'function',
      function: {
        name: 'get_active_users',
        description: 'Get active users on the platform. Active = logged in or created a post in the last 30 days. If onlineOnly is true, returns users active in the last 10 minutes.',
        parameters: { 
          type: 'object', 
          properties: {
            onlineOnly: { type: 'boolean', description: 'Set to true to check for users currently online (active in the last 10 minutes).' }
          }, 
          required: [] 
        },
      },
    },
    handler: async (args: any) => {
      const minutes = args.onlineOnly ? 10 : 30 * 24 * 60;
      const cutoff = new Date(Date.now() - minutes * 60 * 1000);
      const [count, sample] = await Promise.all([
        prisma.user.count({
          where: {
            OR: [
              { updatedAt: { gte: cutoff } },
              { posts: { some: { createdAt: { gte: cutoff } } } }
            ]
          }
        }),
        prisma.user.findMany({
          where: {
            OR: [
              { updatedAt: { gte: cutoff } },
              { posts: { some: { createdAt: { gte: cutoff } } } }
            ]
          },
          take: 5,
          select: { name: true, email: true, updatedAt: true }
        })
      ]);
      const sampleStr = sample.map(u => `  • ${u.name} <${u.email}>`).join('\n');
      return `There are **${count}** users ${args.onlineOnly ? 'currently online' : 'active recently'}.\n\nRecent active users:\n${sampleStr}`;
    }
  },

  get_subscribed_users: {
    definition: {
      type: 'function',
      function: {
        name: 'get_subscribed_users',
        description: 'Get number of workspaces with active paid subscriptions (not basic/free tier), broken down by plan.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async () => {
      const [total, byTier] = await Promise.all([
        prisma.subscription.count({ where: { status: 'active', tier: { not: 'basic' } } }),
        prisma.subscription.groupBy({ by: ['tier'], where: { status: 'active', tier: { not: 'basic' } }, _count: { id: true } })
      ]);
      const breakdown = byTier.map(t => `  • ${t.tier}: ${t._count.id}`).join('\n');
      return `There are **${total}** active paid subscriptions.\n\nBreakdown by plan:\n${breakdown || '  (none)'}`;
    }
  },

  get_inactive_users: {
    definition: {
      type: 'function',
      function: {
        name: 'get_inactive_users',
        description: 'Get users who have had no activity (no login, no post) in the last 30 days.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [count, sample] = await Promise.all([
        prisma.user.count({
          where: {
            updatedAt: { lt: thirtyDaysAgo },
            posts: { none: { createdAt: { gte: thirtyDaysAgo } } }
          }
        }),
        prisma.user.findMany({
          where: {
            updatedAt: { lt: thirtyDaysAgo },
            posts: { none: { createdAt: { gte: thirtyDaysAgo } } }
          },
          take: 5,
          orderBy: { updatedAt: 'asc' },
          select: { name: true, email: true, updatedAt: true }
        })
      ]);
      const sampleStr = sample.map(u => `  • ${u.name} <${u.email}> (last active: ${new Date(u.updatedAt).toLocaleDateString()})`).join('\n');
      return `There are **${count}** inactive users (no activity in 30+ days).\n\nMost inactive:\n${sampleStr}`;
    }
  },

  get_system_analytics: {
    definition: {
      type: 'function',
      function: {
        name: 'get_system_analytics',
        description: 'Get comprehensive platform-wide statistics (total users, workspaces, posts, new signups, published posts, scheduled posts).',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [totalUsers, newUsers, totalWorkspaces, totalPosts, publishedPosts, scheduledPosts, activeSubscriptions] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.workspace.count(),
        prisma.post.count(),
        prisma.post.count({ where: { status: 'published' } }),
        prisma.post.count({ where: { status: 'scheduled' } }),
        prisma.subscription.count({ where: { status: 'active' } }),
      ]);
      return `📊 **Platform Analytics**\n\n**Users:** ${totalUsers} total (${newUsers} new in last 30 days)\n**Workspaces:** ${totalWorkspaces}\n**Active subscriptions:** ${activeSubscriptions}\n\n**Posts:** ${totalPosts} total\n  • Published: ${publishedPosts}\n  • Scheduled: ${scheduledPosts}\n  • Drafts: ${totalPosts - publishedPosts - scheduledPosts}`;
    }
  },

  ban_user: {
    definition: {
      type: 'function',
      function: {
        name: 'ban_user',
        description: 'Suspend a user account by suspending their subscription. MUST set confirm=false first to ask the admin for approval before actually banning.',
        parameters: {
          type: 'object',
          properties: {
            userEmail: { type: 'string', description: 'The email address of the user to ban/suspend.' },
            confirm: { type: 'boolean', description: 'Set to false to ask for confirmation. Set to true ONLY after the admin has explicitly confirmed they want to proceed.' }
          },
          required: ['userEmail', 'confirm'],
        },
      },
    },
    handler: async (args, context) => {
      if (!args.confirm) {
        // First, look up the user so we can show the admin their details before confirming
        const userToCheck = await prisma.user.findUnique({
          where: { email: args.userEmail },
          include: { workspaces: { include: { workspace: { include: { subscription: true } } } } }
        });
        if (!userToCheck) return `No user found with email **${args.userEmail}**. Please double-check the email and try again.`;
        const plan = userToCheck.workspaces[0]?.workspace?.subscription?.tier || 'basic';
        return `⚠️ You are about to suspend **${userToCheck.name}** (${args.userEmail}), currently on the **${plan}** plan. This will suspend their subscription. Are you sure? Reply "yes, ban ${args.userEmail}" to confirm.`;
      }

      const userToBan = await prisma.user.findUnique({
        where: { email: args.userEmail },
        include: { workspaces: { include: { workspace: { include: { subscription: true } } } } }
      });
      if (!userToBan) return `User with email **${args.userEmail}** not found.`;

      // Prevent suspending owners/admins
      const isOwner = userToBan.workspaces.some(wm => wm.role === 'owner');
      if (isOwner) return `❌ Cannot suspend **${userToBan.name}** because they are an owner/admin. Remove their owner role first.`;

      const workspace = userToBan.workspaces[0]?.workspace;
      if (workspace?.subscription) {
        await prisma.subscription.update({
          where: { id: workspace.subscription.id },
          data: { status: 'suspended' }
        });
      }

      await prisma.adminAuditLog.create({
        data: {
          adminId: context.userId,
          action: 'user.suspend',
          targetType: 'user',
          targetId: userToBan.id,
          details: { email: args.userEmail, reason: 'Suspended via AI Chatbot' }
        }
      });
      return `✅ User **${userToBan.name}** (${args.userEmail}) has been suspended successfully.`;
    }
  }
};

// ----------------------------------------
// User Tools (all authenticated users)
// ----------------------------------------

export const userTools: Record<string, { definition: ToolDefinition; handler: ToolHandler }> = {
  get_user_info: {
    definition: {
      type: 'function',
      function: {
        name: 'get_user_info',
        description: 'Get the current user\'s profile information, including their role and workspace ID.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async (args, context) => {
      const user = await prisma.user.findUnique({ where: { id: context.userId } });
      if (!user) return 'Could not retrieve user info.';
      return `User Info:\n- Name: ${user.name}\n- Email: ${user.email}\n- Role: ${context.role}\n- Workspace ID: ${context.workspaceId}`;
    }
  },

  get_user_posts: {
    definition: {
      type: 'function',
      function: {
        name: 'get_user_posts',
        description: 'Get the most recent posts for the current user\'s workspace.',
        parameters: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['draft', 'scheduled', 'published', 'failed'], description: 'Filter by status. Omit to get all.' },
            limit: { type: 'number', description: 'Number of posts to return (default 5, max 20).' }
          },
          required: []
        },
      },
    },
    handler: async (args, context) => {
      const limit = Math.min(args.limit || 5, 20);
      const where: any = { workspaceId: context.workspaceId };
      if (args.status) where.status = args.status;

      const posts = await prisma.post.findMany({
        where,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, content: true, status: true, platforms: true, scheduledAt: true, updatedAt: true }
      });

      if (!posts.length) return `You have no posts${args.status ? ` with status "${args.status}"` : ''} yet.`;

      const lines = posts.map((p, i) => {
        const preview = p.content.length > 80 ? p.content.substring(0, 80) + '…' : p.content;
        const platforms = p.platforms.length ? p.platforms.join(', ') : 'no platforms';
        const schedule = p.scheduledAt ? ` | 📅 ${new Date(p.scheduledAt).toLocaleString()}` : '';
        return `${i + 1}. **[${p.status.toUpperCase()}]** ${preview}\n   Platforms: ${platforms}${schedule}\n   ID: \`${p.id}\``;
      });
      return `Here are your ${posts.length} most recent posts:\n\n${lines.join('\n\n')}`;
    }
  },

  create_post_draft: {
    definition: {
      type: 'function',
      function: {
        name: 'create_post_draft',
        description: 'Create a new post draft with the given content. Platforms are optional.',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The text content for the post (required, must not be empty).' },
            platforms: { type: 'array', items: { type: 'string' }, description: 'Target platforms e.g. ["facebook", "instagram", "twitter"].' }
          },
          required: ['content']
        },
      },
    },
    handler: async (args, context) => {
      if (!args.content || !args.content.trim()) {
        return 'Cannot create a post with empty content. Please provide the post text.';
      }

      const post = await prisma.post.create({
        data: {
          workspaceId: context.workspaceId,
          authorId: context.userId,
          content: args.content.trim(),
          status: 'draft',
          platforms: args.platforms || []
        }
      });

      const platformStr = post.platforms.length ? post.platforms.join(', ') : 'no platforms selected';
      return `✅ Draft created successfully!\n\n**Content preview:** ${post.content.substring(0, 100)}${post.content.length > 100 ? '…' : ''}\n**Platforms:** ${platformStr}\n**Post ID:** \`${post.id}\`\n\nYou can schedule or publish this draft from the Posts section.`;
    }
  },

  get_dashboard_stats: {
    definition: {
      type: 'function',
      function: {
        name: 'get_dashboard_stats',
        description: 'Get engagement metrics and stats for the user\'s current workspace (impressions, likes, comments, shares, post counts).',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async (args, context) => {
      const [publishedCount, draftCount, scheduledCount, snapshots] = await Promise.all([
        prisma.post.count({ where: { workspaceId: context.workspaceId, status: 'published' } }),
        prisma.post.count({ where: { workspaceId: context.workspaceId, status: 'draft' } }),
        prisma.post.count({ where: { workspaceId: context.workspaceId, status: 'scheduled' } }),
        prisma.analyticsSnapshot.aggregate({
          where: { platformPost: { post: { workspaceId: context.workspaceId } } },
          _sum: { impressions: true, likes: true, comments: true, shares: true, clicks: true }
        })
      ]);

      return `📊 **Your Workspace Dashboard**\n\n**Posts:**\n  • Published: ${publishedCount}\n  • Scheduled: ${scheduledCount}\n  • Drafts: ${draftCount}\n\n**Engagement (all time):**\n  • 👁️ Impressions: ${(snapshots._sum.impressions || 0).toLocaleString()}\n  • ❤️ Likes: ${(snapshots._sum.likes || 0).toLocaleString()}\n  • 💬 Comments: ${(snapshots._sum.comments || 0).toLocaleString()}\n  • 🔁 Shares: ${(snapshots._sum.shares || 0).toLocaleString()}\n  • 🖱️ Clicks: ${(snapshots._sum.clicks || 0).toLocaleString()}`;
    }
  },

  delete_post: {
    definition: {
      type: 'function',
      function: {
        name: 'delete_post',
        description: 'Delete a specific post. MUST set confirm=false first to look up the post and ask the user for explicit approval before actually deleting.',
        parameters: {
          type: 'object',
          properties: {
            postId: { type: 'string', description: 'The ID of the post to delete.' },
            confirm: { type: 'boolean', description: 'Set to false to look up and preview the post before deleting. Set to true ONLY after the user has explicitly confirmed.' }
          },
          required: ['postId', 'confirm']
        },
      },
    },
    handler: async (args, context) => {
      // Always look up the post first for safety
      const post = await prisma.post.findUnique({
        where: { id: args.postId },
        select: { id: true, content: true, status: true, platforms: true, workspaceId: true }
      });

      if (!post || post.workspaceId !== context.workspaceId) {
        return `Post not found or you don't have permission to delete it.`;
      }

      if (!args.confirm) {
        const preview = post.content.length > 100 ? post.content.substring(0, 100) + '…' : post.content;
        return `⚠️ You are about to permanently delete this post:\n\n**Status:** ${post.status}\n**Platforms:** ${post.platforms.join(', ') || 'none'}\n**Content:** "${preview}"\n\nThis action cannot be undone. Are you sure? Reply "yes, delete it" to confirm.`;
      }

      await prisma.post.delete({ where: { id: args.postId } });
      return `✅ Post \`${args.postId}\` has been permanently deleted.`;
    }
  }
};
