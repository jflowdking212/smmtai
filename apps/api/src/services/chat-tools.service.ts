import { prisma } from '../config/database.js';
import { connectionService } from './connection.service.js';
import { postService } from './post.service.js';

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

      const targetPlatforms = args.platforms || [];
      const activeConnections = await prisma.socialConnection.findMany({
        where: { workspaceId: context.workspaceId, isActive: true }
      });

      const platformPostsCreate = [];
      const resolvedPlatforms = [];

      if (targetPlatforms.length > 0) {
        for (const p of targetPlatforms) {
          const conn = activeConnections.find((c: any) => c.platform.toLowerCase() === p.toLowerCase());
          if (conn) {
            platformPostsCreate.push({
              socialConnectionId: conn.id,
              platform: conn.platform,
              status: 'draft',
            });
            resolvedPlatforms.push(conn.platform);
          }
        }
      } else {
        for (const conn of activeConnections) {
          platformPostsCreate.push({
            socialConnectionId: conn.id,
            platform: conn.platform,
            status: 'draft',
          });
          resolvedPlatforms.push(conn.platform);
        }
      }

      const post = await prisma.post.create({
        data: {
          workspaceId: context.workspaceId,
          authorId: context.userId,
          content: args.content.trim(),
          status: 'draft',
          platforms: resolvedPlatforms.length > 0 ? resolvedPlatforms : targetPlatforms,
          platformPosts: platformPostsCreate.length > 0 ? {
            create: platformPostsCreate,
          } : undefined,
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
        description: 'Get engagement metrics and stats for the user\'s current workspace (impressions, likes, comments, shares, post counts). Optionally filters by startDate and endDate range.',
        parameters: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'ISO date string for start of range' },
            endDate: { type: 'string', description: 'ISO date string for end of range' }
          },
          required: []
        },
      },
    },
    handler: async (args, context) => {
      const startDate = args.startDate ? new Date(args.startDate) : undefined;
      const endDate = args.endDate ? new Date(args.endDate) : undefined;

      const postWhere: any = { workspaceId: context.workspaceId, status: 'published' };
      const publishedCountWhere: any = { workspaceId: context.workspaceId, status: 'published' };

      if (startDate || endDate) {
        postWhere.publishedAt = {};
        publishedCountWhere.publishedAt = {};
        if (startDate) {
          postWhere.publishedAt.gte = startDate;
          publishedCountWhere.publishedAt.gte = startDate;
        }
        if (endDate) {
          postWhere.publishedAt.lte = endDate;
          publishedCountWhere.publishedAt.lte = endDate;
        }
      }

      const [publishedCount, draftCount, scheduledCount, platformPosts] = await Promise.all([
        prisma.post.count({ where: publishedCountWhere }),
        prisma.post.count({ where: { workspaceId: context.workspaceId, status: 'draft' } }),
        prisma.post.count({ where: { workspaceId: context.workspaceId, status: 'scheduled' } }),
        prisma.platformPost.findMany({
          where: {
            post: postWhere,
            status: 'published',
          },
          include: {
            analytics: {
              orderBy: { capturedAt: 'desc' },
              take: 1,
            },
          },
        })
      ]);

      let totalImpressions = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      let totalClicks = 0;

      platformPosts.forEach((pp) => {
        const latest = pp.analytics[0];
        if (latest) {
          totalImpressions += latest.impressions || 0;
          totalLikes += latest.likes || 0;
          totalComments += latest.comments || 0;
          totalShares += latest.shares || 0;
          totalClicks += latest.clicks || 0;
        }
      });

      return `📊 **Your Workspace Dashboard**\n\n**Posts:**\n  • Published: ${publishedCount}\n  • Scheduled: ${scheduledCount}\n  • Drafts: ${draftCount}\n\n**Engagement (all time):**\n  • 👁️ Impressions: ${totalImpressions.toLocaleString()}\n  • ❤️ Likes: ${totalLikes.toLocaleString()}\n  • 💬 Comments: ${totalComments.toLocaleString()}\n  • 🔁 Shares: ${totalShares.toLocaleString()}\n  • 🖱️ Clicks: ${totalClicks.toLocaleString()}`;
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
  },

  get_workspace_members: {
    definition: {
      type: 'function',
      function: {
        name: 'get_workspace_members',
        description: 'Get current team members and their roles in the user\'s workspace.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async (args, context) => {
      const members = await prisma.workspaceMember.findMany({
        where: { workspaceId: context.workspaceId },
        include: {
          user: { select: { name: true, email: true } }
        }
      });
      const lines = members
        .filter(m => m.user)
        .map(m => `  • **${m.user?.name}** (${m.user?.email}) - Role: **${m.role.toUpperCase()}**`);
      return `👥 **Workspace Team Members**:\n\n${lines.join('\n')}`;
    }
  },

  get_billing_info: {
    definition: {
      type: 'function',
      function: {
        name: 'get_billing_info',
        description: 'Get subscription tier, limits, and billing status for the current workspace.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async (args, context) => {
      const sub = await prisma.subscription.findUnique({
        where: { workspaceId: context.workspaceId }
      });
      if (!sub) return 'Your workspace is currently on the **free/basic** plan.';
      
      const limits = {
        basic: { posts: '10/month', connections: '3 total', seats: '1 seat' },
        pro: { posts: '100/month', connections: '10 total', seats: '5 seats' },
        enterprise: { posts: 'Unlimited', connections: 'Unlimited', seats: 'Unlimited' }
      }[sub.tier.toLowerCase() as 'basic' | 'pro' | 'enterprise'] || { posts: 'Unknown', connections: 'Unknown', seats: 'Unknown' };

      return `💳 **Workspace Subscription & Billing**\n\n**Current Plan:** ${sub.tier.toUpperCase()}\n**Status:** ${sub.status.toUpperCase()}\n\n**Plan Limits:**\n  • Posts: ${limits.posts}\n  • Social Connections: ${limits.connections}\n  • Team Seats: ${limits.seats}`;
    }
  },

  get_calendar: {
    definition: {
      type: 'function',
      function: {
        name: 'get_calendar',
        description: 'Get scheduled posts and calendar entries for the current workspace. Optionally filters by startDate and endDate range.',
        parameters: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'ISO date string for start of range' },
            endDate: { type: 'string', description: 'ISO date string for end of range' }
          },
          required: []
        },
      },
    },
    handler: async (args, context) => {
      const startDate = args.startDate ? new Date(args.startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = args.endDate ? new Date(args.endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const posts = await prisma.post.findMany({
        where: {
          workspaceId: context.workspaceId,
          OR: [
            { status: 'scheduled', scheduledAt: { gte: startDate, lte: endDate } },
            { status: 'published', publishedAt: { gte: startDate, lte: endDate } }
          ]
        },
        orderBy: { scheduledAt: 'asc' },
        select: { id: true, content: true, status: true, scheduledAt: true, publishedAt: true, platforms: true }
      });

      if (!posts.length) {
        return `You have no scheduled or recently published posts on your calendar.`;
      }

      const lines = posts.map(p => {
        const preview = p.content.length > 50 ? p.content.substring(0, 50) + '…' : p.content;
        const time = p.status === 'scheduled' 
          ? `📅 Scheduled: ${new Date(p.scheduledAt!).toLocaleString()}`
          : `✅ Published: ${new Date(p.publishedAt!).toLocaleString()}`;
        return `  • **[${p.status.toUpperCase()}]** "${preview}" (${p.platforms.join(', ') || 'no platforms'}) | ${time}`;
      });

      return `📅 **Workspace Content Calendar** (Recent & Upcoming):\n\n${lines.join('\n')}`;
    }
  },

  publish_post: {
    definition: {
      type: 'function',
      function: {
        name: 'publish_post',
        description: 'Publish a specific draft post immediately. MUST set confirm=false first to confirm post details and get user consent before executing.',
        parameters: {
          type: 'object',
          properties: {
            postId: { type: 'string', description: 'The ID of the post to publish.' },
            confirm: { type: 'boolean', description: 'Set to false to look up and preview the post before publishing. Set to true ONLY after the user has explicitly confirmed.' }
          },
          required: ['postId', 'confirm']
        },
      },
    },
    handler: async (args, context) => {
      const post = await prisma.post.findUnique({
        where: { id: args.postId },
        include: { platformPosts: true, media: true }
      });
      if (!post || post.workspaceId !== context.workspaceId) return 'Post not found or access denied.';
      if (post.status !== 'draft') return `Post status is already **${post.status}**; only drafts can be published immediately.`;

      // Safeguard for visual ads: must have media attached before publishing
      const isVisualAd = post.designData && 
                         typeof post.designData === 'object' && 
                         Array.isArray((post.designData as any).objects) && 
                         (post.designData as any).objects.length > 0;

      if (isVisualAd && (!post.media || post.media.length === 0)) {
        return `⚠️ **This post contains a visual ad design, but the final image has not been generated yet.**\n\nTo publish this post, please first open it in the [Visual Editor](/editor?draftId=${post.id}), verify the design, and click **Save** or **Export** to generate the high-resolution social media image. Once the image is generated, you can publish it directly from the editor or here in the chat.`;
      }

      if (!args.confirm) {
        const preview = post.content.length > 80 ? post.content.substring(0, 80) + '…' : post.content;
        return `⚠️ You are about to publish this draft immediately:\n\n**Content:** "${preview}"\n**Platforms:** ${post.platforms.join(', ') || 'none'}\n\nAre you sure you want to publish it now? Reply "yes, publish post ${args.postId}" to confirm.`;
      }

      try {
        const results = await postService.publishPost(args.postId);
        const successCount = results.filter((r: any) => r.status === 'published').length;
        const failedCount = results.filter((r: any) => r.status === 'failed' || r.status === 'error').length;
        
        let report = `✅ **Publishing attempt completed!**\n\n`;
        report += `• **Published successfully:** ${successCount} platform(s)\n`;
        report += `• **Failed:** ${failedCount} platform(s)\n\n`;
        
        results.forEach((r: any) => {
          if (r.status === 'published') {
            report += `  - **${r.platform.toUpperCase()}**: Published successfully! [View Post](${r.url || '#'})\n`;
          } else {
            report += `  - **${r.platform ? r.platform.toUpperCase() : 'UNKNOWN'}**: Failed. ${r.error || 'Unknown error'}\n`;
          }
        });
        
        return report;
      } catch (err: any) {
        return `❌ **Failed to publish post:** ${err?.message || err}`;
      }
    }
  },

  schedule_post: {
    definition: {
      type: 'function',
      function: {
        name: 'schedule_post',
        description: 'Schedule a specific draft post for a future date/time. MUST set confirm=false first to confirm schedule details and get user consent.',
        parameters: {
          type: 'object',
          properties: {
            postId: { type: 'string', description: 'The ID of the post to schedule.' },
            scheduledAt: { type: 'string', description: 'Target date and time in ISO or absolute format (e.g. "2026-06-01T10:00:00Z").' },
            confirm: { type: 'boolean', description: 'Set to false to look up and preview the post details before scheduling. Set to true ONLY after the user has explicitly confirmed.' }
          },
          required: ['postId', 'scheduledAt', 'confirm']
        },
      },
    },
    handler: async (args, context) => {
      const post = await prisma.post.findUnique({ where: { id: args.postId } });
      if (!post || post.workspaceId !== context.workspaceId) return 'Post not found or access denied.';
      if (post.status !== 'draft') return `Post is already **${post.status}**; only drafts can be scheduled.`;

      const schedTime = new Date(args.scheduledAt);
      if (Number.isNaN(schedTime.getTime()) || schedTime.getTime() <= Date.now()) {
        return `Please provide a valid future date and time (e.g. "2026-06-01T10:00:00Z").`;
      }

      if (!args.confirm) {
        const preview = post.content.length > 80 ? post.content.substring(0, 80) + '…' : post.content;
        return `⏰ You are about to schedule this draft:\n\n**Content:** "${preview}"\n**Target Time:** ${schedTime.toLocaleString()}\n**Platforms:** ${post.platforms.join(', ') || 'none'}\n\nAre you sure? Reply "yes, schedule post ${args.postId} for ${args.scheduledAt}" to confirm.`;
      }

      await prisma.post.update({
        where: { id: args.postId },
        data: { status: 'scheduled', scheduledAt: schedTime }
      });
      return `✅ Post \`${args.postId}\` has been successfully scheduled for ${schedTime.toLocaleString()}!`;
    }
  },

  connect_social_platform: {
    definition: {
      type: 'function',
      function: {
        name: 'connect_social_platform',
        description: 'Initiate a secure OAuth 2.0 connection redirect link for a social platform (facebook, instagram, twitter, linkedin, youtube, pinterest, tiktok, telegram, bluesky, mastodon) to render an interactive connect button for the user.',
        parameters: {
          type: 'object',
          properties: {
            platform: { type: 'string', enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'pinterest', 'tiktok', 'telegram', 'bluesky', 'mastodon'], description: 'The target social platform' }
          },
          required: ['platform']
        },
      },
    },
    handler: async (args, context) => {
      try {
        const authUrl = await connectionService.initiateConnection(context.workspaceId, args.platform);
        return `I have generated a secure connection link for **${args.platform.toUpperCase()}**.\n\n👉 [Connect to ${args.platform.charAt(0).toUpperCase() + args.platform.slice(1)}](${authUrl})`;
      } catch (err: any) {
        return `Failed to generate connection link: ${err?.message || err}`;
      }
    }
  },

  create_designed_ad_draft: {
    definition: {
      type: 'function',
      function: {
        name: 'create_designed_ad_draft',
        description: 'Create a premium industry-grade designed social media post or ad draft using SmmtAI Visual Engine V3. Supports 900+ combinations of layouts, high-class palettes, font pairings, sizes, and curated stock photo categories. Returns a visual Composer deep-link.',
        parameters: {
          type: 'object',
          properties: {
            headline: { type: 'string', description: 'Large primary headline text for the ad' },
            body: { type: 'string', description: 'Secondary subheadline or description copy' },
            brandName: { type: 'string', description: 'Name of your brand or company' },
            ctaText: { type: 'string', description: 'Call to action text (e.g. LEARN MORE, SHOP NOW, SIGN UP, REGISTER NOW)' },
            size: {
              type: 'string',
              enum: ['square', 'landscape', 'story', 'banner'],
              description: 'Social media dimension size preset.'
            },
            layout: {
              type: 'string',
              enum: ['classic', 'centered', 'split', 'card', 'hero', 'minimal'],
              description: 'Structural wireframe layout style.'
            },
            palette: {
              type: 'string',
              enum: ['saas', 'lux_dark', 'lux_light', 'realestate', 'beauty', 'fitness', 'organic', 'medical', 'agency', 'retro', 'cyberpunk', 'nordic', 'minimalist', 'autumn', 'royal'],
              description: 'Premium curated color palette theme matching the niche.'
            },
            fontPairing: {
              type: 'string',
              enum: ['outfit_inter', 'playfair_lora', 'oswald_montserrat', 'syne_inter', 'space_jakarta', 'merriweather_opensans', 'anton_roboto', 'lato_lato', 'cabin_cabin', 'archivo_archivo'],
              description: 'Google Font pair combination for bold headers & clean body copy.'
            },
            imageCategory: {
              type: 'string',
              enum: ['tech', 'marketing', 'realestate', 'beauty', 'fitness', 'food', 'coffee', 'fashion', 'travel', 'education', 'medical', 'none'],
              description: 'High-quality curated stock background photograph category.'
            },
            backgroundColor: { type: 'string', description: 'Custom background Hex color override' },
            accentColor: { type: 'string', description: 'Custom accent/button Hex color override' },
            textColor: { type: 'string', description: 'Custom primary text Hex color override' },
            platforms: { type: 'array', items: { type: 'string' }, description: 'Target platforms (default based on platform sizes)' }
          },
          required: ['headline', 'body', 'brandName']
        },
      },
    },
    handler: async (args, context) => {
      try {
        const headline = args.headline || 'Unlock Your Potential';
        const body = args.body || 'Start growing your brand today with SmmtAI.';
        const brandName = (args.brandName || 'SMMTAI').toUpperCase();
        const ctaText = (args.ctaText || 'LEARN MORE').toUpperCase();
        
        const sizePreset = args.size || 'landscape';
        const layoutPreset = args.layout || 'classic';
        const palettePreset = args.palette || 'saas';
        const fontPreset = args.fontPairing || 'outfit_inter';
        const imgCategory = args.imageCategory || 'none';

        // 1. Dimensions Mapping
        let W = 1200;
        let H = 628;
        if (sizePreset === 'square') { W = 1080; H = 1080; }
        else if (sizePreset === 'story') { W = 1080; H = 1920; }
        else if (sizePreset === 'banner') { W = 1200; H = 400; }

        // 2. Color Palettes Mapping
        const palettes: Record<string, { bg: string; accent: string; text: string; subtext: string }> = {
          saas: { bg: '#0f172a', accent: '#3b82f6', text: '#ffffff', subtext: '#94a3b8' },
          lux_dark: { bg: '#09090b', accent: '#d4af37', text: '#fafaf9', subtext: '#a1a1aa' },
          lux_light: { bg: '#f5f5f4', accent: '#1c1917', text: '#1c1917', subtext: '#57534e' },
          realestate: { bg: '#1e293b', accent: '#b45309', text: '#ffffff', subtext: '#cbd5e1' },
          beauty: { bg: '#fdf4ff', accent: '#f472b6', text: '#4a044e', subtext: '#701a75' },
          fitness: { bg: '#000000', accent: '#84cc16', text: '#ffffff', subtext: '#d9f99d' },
          organic: { bg: '#064e3b', accent: '#10b981', text: '#f0fdf4', subtext: '#a7f3d0' },
          medical: { bg: '#f0f9ff', accent: '#0284c7', text: '#0f172a', subtext: '#334155' },
          agency: { bg: '#312e81', accent: '#ec4899', text: '#ffffff', subtext: '#c7d2fe' },
          retro: { bg: '#fef3c7', accent: '#d97706', text: '#78350f', subtext: '#92400e' },
          cyberpunk: { bg: '#030712', accent: '#f43f5e', text: '#ffffff', subtext: '#22d3ee' },
          nordic: { bg: '#f1f5f9', accent: '#475569', text: '#0f172a', subtext: '#475569' },
          minimalist: { bg: '#18181b', accent: '#fafafa', text: '#ffffff', subtext: '#a1a1aa' },
          autumn: { bg: '#451a03', accent: '#f97316', text: '#fef2f2', subtext: '#fdba74' },
          royal: { bg: '#1e1b4b', accent: '#fbbf24', text: '#ffffff', subtext: '#c7d2fe' }
        };

        const activePalette = palettes[palettePreset] || palettes.saas;
        let bgColor = activePalette.bg;
        let accentColor = activePalette.accent;
        let textColor = activePalette.text;
        let subtextColor = activePalette.subtext;

        // Custom overrides
        if (args.backgroundColor) bgColor = args.backgroundColor;
        if (args.accentColor) accentColor = args.accentColor;
        if (args.textColor) textColor = args.textColor;

        // 3. Font Pairings Mapping
        const fontPairings: Record<string, { title: string; body: string }> = {
          outfit_inter: { title: 'Outfit', body: 'Inter' },
          playfair_lora: { title: 'Playfair Display', body: 'Lora' },
          oswald_montserrat: { title: 'Oswald', body: 'Montserrat' },
          syne_inter: { title: 'Syne', body: 'Inter' },
          space_jakarta: { title: 'Space Grotesk', body: 'Plus Jakarta Sans' },
          merriweather_opensans: { title: 'Merriweather', body: 'Open Sans' },
          anton_roboto: { title: 'Anton', body: 'Roboto' },
          lato_lato: { title: 'Lato', body: 'Lato' },
          cabin_cabin: { title: 'Cabin', body: 'Cabin' },
          archivo_archivo: { title: 'Archivo', body: 'Archivo' }
        };

        const activeFont = fontPairings[fontPreset] || fontPairings.outfit_inter;
        const titleFont = activeFont.title;
        const bodyFont = activeFont.body;

        const targetPlatforms = args.platforms || (sizePreset === 'story' ? ['instagram'] : ['facebook']);

        // 4. Stock background photograph mapping
        const unsplashIds: Record<string, string> = {
          tech: 'photo-1451187580459-43490279c0fa',
          marketing: 'photo-1460925895917-afdab827c52f',
          realestate: 'photo-1564013799919-ab600027ffc6',
          beauty: 'photo-1596462502278-27bfdc403348',
          fitness: 'photo-1517838277536-f5f99be501cd',
          food: 'photo-1504674900247-0877df9cc836',
          coffee: 'photo-1509042239860-f550ce710b93',
          fashion: 'photo-1483985988355-763728e1935b',
          travel: 'photo-1507525428034-b723cf961d3e',
          education: 'photo-1522202176988-66273c2fd55f',
          medical: 'photo-1506126613408-eca07ce68773'
        };

        const canvasObjects: any[] = [];

        // Add background rect/image
        if (imgCategory !== 'none' && unsplashIds[imgCategory]) {
          const photoId = unsplashIds[imgCategory];
          const imgUrl = `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${W}&h=${H}&q=80`;
          
          canvasObjects.push({
            type: 'image',
            version: '5.3.0',
            originX: 'left',
            originY: 'top',
            left: 0,
            top: 0,
            width: W,
            height: H,
            src: imgUrl,
            crossOrigin: 'anonymous',
            selectable: false
          });

          // Overlay Tint layer for high readability
          canvasObjects.push({
            type: 'rect',
            version: '5.3.0',
            originX: 'left',
            originY: 'top',
            left: 0,
            top: 0,
            width: W,
            height: H,
            fill: 'rgba(15, 23, 42, 0.65)',
            selectable: false
          });
        } else {
          // Solid Background
          const fillVal = bgColor.startsWith('linear-gradient') ? '#0f172a' : bgColor;
          canvasObjects.push({
            type: 'rect',
            version: '5.3.0',
            originX: 'left',
            originY: 'top',
            left: 0,
            top: 0,
            width: W,
            height: H,
            fill: fillVal,
            selectable: false
          });
        }

        // Inner Border Frame logic (`minimal`)
        if (layoutPreset === 'minimal') {
          const borderPadding = Math.min(W, H) * 0.05;
          canvasObjects.push({
            type: 'rect',
            version: '5.3.0',
            left: borderPadding,
            top: borderPadding,
            width: W - (borderPadding * 2),
            height: H - (borderPadding * 2),
            fill: 'transparent',
            stroke: accentColor,
            strokeWidth: 3,
            selectable: false
          });
        }

        // Card container overlay logic (`card`)
        if (layoutPreset === 'card') {
          const isDarkPalette = bgColor === '#09090b' || bgColor === '#0f172a' || bgColor === '#000000' || bgColor === '#18181b' || bgColor === '#1e1b4b';
          const cardFill = isDarkPalette ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)';
          
          canvasObjects.push({
            type: 'rect',
            version: '5.3.0',
            left: W * 0.05,
            top: H * 0.15,
            width: W * 0.90,
            height: H * 0.70,
            fill: cardFill,
            rx: 15,
            ry: 15,
            stroke: isDarkPalette ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            strokeWidth: 1,
            selectable: true
          });
        }

        // 5. Layout Alignment Math
        let brandLeft, brandTop, brandWidth, brandAlign: 'left' | 'center' | 'right' = 'left';
        let titleLeft, titleTop, titleWidth, titleSize, titleAlign: 'left' | 'center' | 'right' = 'left';
        let bodyLeft, bodyTop, bodyWidth, bodySize, bodyAlign: 'left' | 'center' | 'right' = 'left';
        let btnLeft, btnTop, btnWidth, btnHeight, btnTextTop;

        const isStory = sizePreset === 'story';

        if (layoutPreset === 'centered' || isStory) {
          // Centered Stack Alignment
          brandAlign = 'center';
          brandWidth = W * 0.80;
          brandLeft = W/2 - brandWidth/2;
          brandTop = isStory ? H * 0.10 : H * 0.14;

          titleAlign = 'center';
          titleWidth = W * 0.80;
          titleLeft = W/2 - titleWidth/2;
          titleTop = isStory ? H * 0.20 : H * 0.26;
          titleSize = isStory ? Math.floor(W * 0.052) : Math.floor(W * 0.046);

          bodyAlign = 'center';
          bodyWidth = W * 0.80;
          bodyLeft = W/2 - bodyWidth/2;
          bodyTop = isStory ? H * 0.50 : H * 0.54;
          bodySize = isStory ? Math.floor(W * 0.024) : Math.floor(W * 0.022);

          btnWidth = isStory ? W * 0.80 : 260;
          btnHeight = isStory ? 64 : 56;
          btnLeft = W/2 - btnWidth/2;
          btnTop = isStory ? H * 0.78 : H * 0.74;
          btnTextTop = btnTop + Math.floor(btnHeight * 0.28);
        } else if (layoutPreset === 'split') {
          // Split Screen (Headline left, Button right)
          brandLeft = W * 0.08;
          brandTop = H * 0.12;
          brandWidth = W * 0.40;

          titleLeft = W * 0.08;
          titleTop = H * 0.28;
          titleWidth = W * 0.45;
          titleSize = Math.floor(W * 0.04);

          bodyLeft = W * 0.08;
          bodyTop = H * 0.60;
          bodyWidth = W * 0.45;
          bodySize = 22;

          btnWidth = 260;
          btnHeight = 60;
          btnLeft = W * 0.65;
          btnTop = H * 0.45;
          btnTextTop = btnTop + 18;
        } else if (layoutPreset === 'hero') {
          // Extra Large Giant Title
          brandLeft = W * 0.08;
          brandTop = H * 0.10;
          brandWidth = W * 0.80;

          titleLeft = W * 0.08;
          titleTop = H * 0.20;
          titleWidth = W * 0.84;
          titleSize = Math.floor(W * 0.058);

          bodyLeft = W * 0.08;
          bodyTop = H * 0.52;
          bodyWidth = W * 0.84;
          bodySize = 24;

          btnWidth = 250;
          btnHeight = 56;
          btnLeft = W * 0.08;
          btnTop = H * 0.76;
          btnTextTop = btnTop + 16;
        } else {
          // Classic Left-Aligned & Card Layout
          const paddingOffset = layoutPreset === 'card' ? 0.12 : 0.08;
          
          brandLeft = W * paddingOffset;
          brandTop = H * 0.14;
          brandWidth = W * 0.50;

          titleLeft = W * paddingOffset;
          titleTop = H * 0.26;
          titleWidth = W * 0.76;
          titleSize = sizePreset === 'square' ? 44 : 52;

          bodyLeft = W * paddingOffset;
          bodyTop = sizePreset === 'square' ? H * 0.52 : H * 0.55;
          bodyWidth = W * 0.76;
          bodySize = 24;

          btnWidth = 250;
          btnHeight = 56;
          btnLeft = W * paddingOffset;
          btnTop = sizePreset === 'square' ? H * 0.75 : H * 0.76;
          btnTextTop = btnTop + 16;
        }

        // Add Logo Text
        canvasObjects.push({
          type: 'textbox',
          version: '5.3.0',
          left: brandLeft,
          top: brandTop,
          width: brandWidth,
          text: brandName,
          fontSize: Math.max(16, Math.min(24, Math.floor(W * 0.02))),
          fontWeight: 'bold',
          fontFamily: titleFont,
          fill: accentColor,
          textAlign: brandAlign,
          selectable: true
        });

        // Add Headline
        canvasObjects.push({
          type: 'textbox',
          version: '5.3.0',
          left: titleLeft,
          top: titleTop,
          width: titleWidth,
          text: headline,
          fontSize: titleSize,
          fontWeight: 'bold',
          fontFamily: titleFont,
          fill: textColor,
          charSpacing: -1,
          lineHeight: 1.1,
          textAlign: titleAlign,
          selectable: true
        });

        // Add Body Description
        canvasObjects.push({
          type: 'textbox',
          version: '5.3.0',
          left: bodyLeft,
          top: bodyTop,
          width: bodyWidth,
          text: body,
          fontSize: bodySize,
          fontFamily: bodyFont,
          fill: imgCategory !== 'none' ? '#e2e8f0' : subtextColor,
          lineHeight: 1.3,
          textAlign: bodyAlign,
          selectable: true
        });

        // Add Button Box
        canvasObjects.push({
          type: 'rect',
          version: '5.3.0',
          left: btnLeft,
          top: btnTop,
          width: btnWidth,
          height: btnHeight,
          fill: accentColor,
          rx: 10,
          ry: 10,
          selectable: true
        });

        // Add Button Text
        canvasObjects.push({
          type: 'textbox',
          version: '5.3.0',
          left: btnLeft,
          top: btnTextTop,
          width: btnWidth,
          text: ctaText,
          fontSize: Math.max(13, Math.min(18, Math.floor(btnHeight * 0.32))),
          fontWeight: 'bold',
          fontFamily: bodyFont,
          fill: (palettePreset === 'lux_light' || palettePreset === 'retro' || palettePreset === 'nordic') ? '#1c1917' : '#ffffff',
          textAlign: 'center',
          selectable: true
        });

        const designData = {
          version: '5.3.0',
          objects: canvasObjects
        };

        // Check for active connections in the workspace to map platformPosts conditionally
        const activeConnections = await prisma.socialConnection.findMany({
          where: { workspaceId: context.workspaceId }
        });

        const platformPostsCreate = [];
        for (const p of targetPlatforms) {
          const conn = activeConnections.find((c: any) => c.platform.toLowerCase() === p.toLowerCase());
          if (conn) {
            platformPostsCreate.push({
              socialConnectionId: conn.id,
              platform: p,
              status: 'draft',
            });
          }
        }

        const post = await prisma.post.create({
          data: {
            workspaceId: context.workspaceId,
            authorId: context.userId,
            content: `${headline}\n\n${body}`,
            status: 'draft',
            platforms: targetPlatforms,
            designData: designData as any,
            platformPosts: platformPostsCreate.length > 0 ? {
              create: platformPostsCreate,
            } : undefined,
          }
        });

        const platformLabels = targetPlatforms.map((p: string) => p.toUpperCase()).join(' & ');
        return `🎨 **I have generated your premium ${palettePreset.toUpperCase()} style ${sizePreset.toUpperCase()} ad template (${layoutPreset} layout) for ${platformLabels}!**\n\n👉 [Open in Visual Editor](/editor?draftId=${post.id})\n\nPlease click the link to preview the layout, adjust details visually in SmmtAI's editor, upload your custom logo, and publish or schedule the post when ready!`;
      } catch (err: any) {
        return `Failed to create designed post draft: ${err?.message || err}`;
      }
    }
  },

  get_connected_platforms: {
    definition: {
      type: 'function',
      function: {
        name: 'get_connected_platforms',
        description: "Get a list of all social media accounts currently connected to the user's workspace, including platform name, account name, and connection status.",
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async (args, context) => {
      const connections = await prisma.socialConnection.findMany({
        where: { workspaceId: context.workspaceId },
        select: { platform: true, accountName: true, isActive: true, createdAt: true }
      });
      if (!connections.length) return 'You have no social accounts connected yet. Use the Connections page to link your accounts.';
      const lines = connections.map(c =>
        `  • **${c.platform.toUpperCase()}** — @${c.accountName || 'unknown'} (${c.isActive ? '✅ Active' : '❌ Inactive'})`
      );
      return `🔗 **Connected Social Accounts (${connections.length} total):**\n\n${lines.join('\n')}`;
    }
  },

  get_ai_usage: {
    definition: {
      type: 'function',
      function: {
        name: 'get_ai_usage',
        description: "Get the current user's AI content generation usage this billing period — how many generations have been used vs their plan limit.",
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async (args, context) => {
      const [sub, usageRecords] = await Promise.all([
        prisma.subscription.findUnique({ where: { workspaceId: context.workspaceId } }),
        prisma.usageRecord.findMany({
          where: {
            workspaceId: context.workspaceId,
            type: 'ai_generation',
            createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
          }
        })
      ]);
      const used = usageRecords.length;
      const tier = sub?.tier?.toLowerCase() || 'basic';
      const limits: Record<string, number> = { basic: 25, pro: 100, business: 500, enterprise: -1 };
      const limit = limits[tier] ?? 25;
      const limitStr = limit === -1 ? 'Unlimited' : `${limit}`;
      const remaining = limit === -1 ? 'Unlimited' : Math.max(0, limit - used);
      return `🤖 **AI Generation Usage This Month**\n\n**Plan:** ${tier.toUpperCase()}\n**Used:** ${used} generations\n**Limit:** ${limitStr}\n**Remaining:** ${remaining}\n\n${used >= limit && limit !== -1 ? '⚠️ You have reached your monthly AI limit. Upgrade your plan for more.' : '✅ You have AI generations available.'}`;
    }
  },

  get_templates: {
    definition: {
      type: 'function',
      function: {
        name: 'get_templates',
        description: "Get the user's saved post templates in their workspace.",
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of templates to return (default 10, max 20).' }
          },
          required: []
        },
      },
    },
    handler: async (args, context) => {
      const limit = Math.min(args.limit || 10, 20);
      const templates = await prisma.template.findMany({
        where: { workspaceId: context.workspaceId },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, category: true, platforms: true, createdAt: true }
      });
      if (!templates.length) return 'You have no saved templates yet. Create one from the Templates section.';
      const lines = templates.map((t, i) =>
        `${i + 1}. **${t.name}** (${t.category || 'Uncategorized'}) — Platforms: ${(t.platforms as string[]).join(', ') || 'any'}`
      );
      return `📋 **Your Saved Templates (${templates.length} shown):**\n\n${lines.join('\n')}`;
    }
  },

  get_platform_analytics: {
    definition: {
      type: 'function',
      function: {
        name: 'get_platform_analytics',
        description: "Get a per-platform breakdown of engagement (impressions, likes, comments, shares) for the user's workspace.",
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async (args, context) => {
      const platformPosts = await prisma.platformPost.findMany({
        where: {
          post: { workspaceId: context.workspaceId, status: 'published' },
          status: 'published',
        },
        include: {
          analytics: { orderBy: { capturedAt: 'desc' }, take: 1 }
        }
      });

      const byPlatform: Record<string, { impressions: number; likes: number; comments: number; shares: number; posts: number }> = {};
      for (const pp of platformPosts) {
        const p = pp.platform;
        if (!byPlatform[p]) byPlatform[p] = { impressions: 0, likes: 0, comments: 0, shares: 0, posts: 0 };
        byPlatform[p].posts++;
        const latest = pp.analytics[0];
        if (latest) {
          byPlatform[p].impressions += latest.impressions || 0;
          byPlatform[p].likes += latest.likes || 0;
          byPlatform[p].comments += latest.comments || 0;
          byPlatform[p].shares += latest.shares || 0;
        }
      }

      if (!Object.keys(byPlatform).length) return 'No published post analytics available yet. Publish some posts to see per-platform data.';

      const lines = Object.entries(byPlatform).map(([platform, stats]) =>
        `  • **${platform.toUpperCase()}** — ${stats.posts} posts | 👁️ ${stats.impressions.toLocaleString()} impressions | ❤️ ${stats.likes.toLocaleString()} likes | 💬 ${stats.comments.toLocaleString()} comments | 🔁 ${stats.shares.toLocaleString()} shares`
      );
      return `📊 **Per-Platform Analytics Breakdown:**\n\n${lines.join('\n')}`;
    }
  },
};
