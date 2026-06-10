import { PLATFORMS } from '@ee-postmind/shared';
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
        const platforms5a = (args.platforms || []) as string[];
        const platformHint5a = platforms5a.length ? ` to **${platforms5a.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}**` : '';
        return `Got it! You want to create a post${platformHint5a}.\n\nWhat would you like to say? Just tell me the content, or say something like:\n\u2022 *"write something about [topic] for ${platforms5a[0] || 'my page'}"*\n\u2022 *"create an AI post about [your topic]"*\n\nI\u2019ll write the full post for you! \u{1F4DD}`;
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
      return `\u2705 Draft created successfully!\n\n**Content preview:** ${post.content.substring(0, 100)}${post.content.length > 100 ? '\u2026' : ''}\n**Platforms:** ${platformStr}\n**Post ID:** \`${post.id}\`\n\n\u{1F449} [Open in Compose](/compose?draftId=${post.id}) \u2022 [View All Drafts](/posts?filter=DRAFT)\n\nOr ask me to **schedule it**, **publish it now**, or **improve the content**!`;
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
            platform: { type: 'string', enum: Object.keys(PLATFORMS), description: 'The target social platform' }
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
        return `\u{1F3A8} **Premium ${palettePreset.toUpperCase()} ${sizePreset.toUpperCase()} Ad Created!** (${layoutPreset} layout \u2022 ${platformLabels})\n\n**Post ID:** \`${post.id}\`\n\n\u{1F449} [Open in Visual Editor](/compose?draftId=${post.id}) \u2022 [View All Drafts](/posts?filter=DRAFT)\n\nIn the editor you can:\n\u2022 Preview the full design\n\u2022 Upload your custom logo\n\u2022 Adjust text, colors, and images\n\u2022 Publish or schedule directly\n\nOr ask me to **publish it now**, **schedule it**, or **tweak the design**!`;
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
      const sub = await prisma.subscription.findUnique({
        where: { workspaceId: context.workspaceId },
        include: {
          usageRecords: {
            where: {
              metric: 'ai_generations',
              periodStart: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
            },
            orderBy: { periodStart: 'desc' },
            take: 1
          }
        }
      });
      const tier = sub?.tier?.toLowerCase() || 'basic';
      const limits: Record<string, number> = { basic: 25, pro: 100, business: 500, enterprise: -1 };
      const limit = limits[tier] ?? 25;
      const used = sub?.usageRecords?.[0]?.count ?? 0;
      const limitStr = limit === -1 ? 'Unlimited' : `${limit}`;
      const remaining = limit === -1 ? 'Unlimited' : Math.max(0, limit - used);
      return `🤖 **AI Generation Usage This Month**\n\n**Plan:** ${tier.toUpperCase()}\n**Used:** ${used} generations\n**Limit:** ${limitStr}\n**Remaining:** ${remaining}\n\n${used >= limit && limit !== -1 ? '⚠️ You have reached your monthly AI limit. Upgrade your plan for more.' : '✅ You have AI generations available.'}`;
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

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPLATES
  // ─────────────────────────────────────────────────────────────────────────

  get_templates: {
    definition: {
      type: 'function',
      function: {
        name: 'get_templates',
        description: "Get the user's saved post templates (custom workspace templates + system templates). Optionally filter by category or search by name keyword.",
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Filter templates by category (e.g. promotional, educational, engagement, announcement).' },
            search: { type: 'string', description: 'Keyword to search template names.' },
            limit: { type: 'number', description: 'Number of templates to return (default 10, max 20).' }
          },
          required: []
        },
      },
    },
    handler: async (args, context) => {
      const limit = Math.min(args.limit || 10, 20);
      const where: any = {
        OR: [
          { isSystem: true },
          { workspaceId: context.workspaceId },
        ],
      };
      if (args.category) where.category = { contains: args.category, mode: 'insensitive' };
      if (args.search) where.name = { contains: args.search, mode: 'insensitive' };

      const templates = await prisma.template.findMany({
        where,
        take: limit,
        orderBy: [{ isSystem: 'asc' }, { createdAt: 'desc' }],
        select: { id: true, name: true, category: true, platforms: true, isSystem: true, isPremium: true, createdAt: true }
      });

      if (!templates.length) return `No templates found${args.search ? ` matching "${args.search}"` : ''}${args.category ? ` in "${args.category}" category` : ''}. Visit the **Templates** section to browse all available templates.`;

      const lines = templates.map((t, i) => {
        const badge = t.isSystem ? '🌐 System' : '✏️ Custom';
        const premium = t.isPremium ? ' 👑' : '';
        const platforms = Array.isArray(t.platforms) && t.platforms.length ? (t.platforms as string[]).join(', ') : 'any platform';
        return `${i + 1}. **${t.name}**${premium} [${badge}] — Category: ${t.category || 'General'} | Platforms: ${platforms}\n   ID: \`${t.id}\``;
      });

      return `📋 **Templates (${templates.length} shown):**\n\n${lines.join('\n\n')}\n\n💡 Say "use template [name]" to create a post from a template, or visit [Templates](/templates) to browse all.`;
    }
  },

  use_template: {
    definition: {
      type: 'function',
      function: {
        name: 'use_template',
        description: 'Create a new post draft based on a saved template. Opens the compose view with the template pre-loaded.',
        parameters: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'The ID of the template to use.' },
            platforms: { type: 'array', items: { type: 'string' }, description: 'Override the target platforms (optional, defaults to template platforms).' }
          },
          required: ['templateId']
        },
      },
    },
    handler: async (args, context) => {
      const template = await prisma.template.findUnique({
        where: { id: args.templateId },
        select: { id: true, name: true, category: true, platforms: true, designData: true, isSystem: true }
      });

      if (!template) return `Template \`${args.templateId}\` not found. Use **get_templates** to list available templates.`;

      // Create a draft post from this template
      const targetPlatforms = args.platforms || (template.platforms as string[]) || [];
      const activeConnections = await prisma.socialConnection.findMany({
        where: { workspaceId: context.workspaceId, isActive: true }
      });

      const platformPostsCreate = [];
      for (const p of targetPlatforms) {
        const conn = activeConnections.find((c: any) => c.platform.toLowerCase() === p.toLowerCase());
        if (conn) {
          platformPostsCreate.push({ socialConnectionId: conn.id, platform: conn.platform, status: 'draft' });
        }
      }

      const post = await prisma.post.create({
        data: {
          workspaceId: context.workspaceId,
          authorId: context.userId,
          content: `[Template: ${template.name}]`,
          status: 'draft',
          platforms: targetPlatforms,
          designData: template.designData as any,
          platformPosts: platformPostsCreate.length > 0 ? { create: platformPostsCreate } : undefined,
        }
      });

      return `✅ **Draft created from template "${template.name}"!**\n\n**Post ID:** \`${post.id}\`\n**Platforms:** ${targetPlatforms.join(', ') || 'not set yet'}\n\n👉 [Open in Visual Editor](/compose?draftId=${post.id}) to customise and publish.\n\nOr ask me to **schedule it** or **publish it now**!`;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CONTENT PLANNER
  // ─────────────────────────────────────────────────────────────────────────

  get_content_plans: {
    definition: {
      type: 'function',
      function: {
        name: 'get_content_plans',
        description: "List the user's content plans (AI-generated multi-day social media schedules). Shows status, date range, and post count for each plan.",
        parameters: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['generating', 'ready', 'active', 'cancelled', 'completed'], description: 'Filter by plan status.' },
            limit: { type: 'number', description: 'Number of plans to return (default 5, max 10).' }
          },
          required: []
        },
      },
    },
    handler: async (args, context) => {
      const limit = Math.min(args.limit || 5, 10);
      const where: any = { workspaceId: context.workspaceId };
      if (args.status) where.status = args.status;

      const plans = await prisma.contentPlan.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { posts: true } } }
      });

      if (!plans.length) return `You have no content plans${args.status ? ` with status "${args.status}"` : ''} yet.\n\n💡 Go to [Content Planner](/content-planner) or ask me: *"Create a content plan for my brand for the next 7 days"*.`;

      const statusEmoji: Record<string, string> = {
        ready: '✅', active: '🟢', generating: '⏳', cancelled: '❌', completed: '🏁'
      };

      const lines = plans.map((plan, i) => {
        const emoji = statusEmoji[plan.status] || '📋';
        const start = plan.dateRangeStart ? new Date(plan.dateRangeStart).toLocaleDateString() : '—';
        const end = plan.dateRangeEnd ? new Date(plan.dateRangeEnd).toLocaleDateString() : '—';
        return `${i + 1}. ${emoji} **${plan.theme || 'Content Plan'}** — ${plan._count.posts} posts | ${start} → ${end} | Status: **${plan.status}**\n   ID: \`${plan.id}\``;
      });

      return `📅 **Your Content Plans (${plans.length} shown):**\n\n${lines.join('\n\n')}\n\n💡 Say "show me plan [ID]" to see all posts in a specific plan, or "create a content plan" to generate a new one.`;
    }
  },

  get_content_plan_posts: {
    definition: {
      type: 'function',
      function: {
        name: 'get_content_plan_posts',
        description: "Get all scheduled posts inside a specific content plan. Shows content, platform, scheduled time, and review status.",
        parameters: {
          type: 'object',
          properties: {
            planId: { type: 'string', description: 'The content plan ID.' },
            limit: { type: 'number', description: 'Number of posts to show (default 10).' }
          },
          required: ['planId']
        },
      },
    },
    handler: async (args, context) => {
      const limit = Math.min(args.limit || 10, 30);
      const plan = await prisma.contentPlan.findUnique({
        where: { id: args.planId, workspaceId: context.workspaceId },
        include: {
          posts: {
            orderBy: { scheduledAt: 'asc' },
            take: limit,
            select: { id: true, platform: true, contentBody: true, scheduledAt: true, status: true, hashtags: true }
          }
        }
      });

      if (!plan) return `Content plan \`${args.planId}\` not found. Use **get_content_plans** to list your plans.`;

      if (!plan.posts.length) return `Content plan "${plan.theme}" has no posts yet. It may still be generating.`;

      const lines = plan.posts.map((p, i) => {
        const preview = p.contentBody.length > 80 ? p.contentBody.substring(0, 80) + '…' : p.contentBody;
        const time = p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : 'Not scheduled';
        const tags = Array.isArray(p.hashtags) && p.hashtags.length ? `#${(p.hashtags as string[]).slice(0, 3).join(' #')}` : '';
        return `${i + 1}. **[${p.platform.toUpperCase()}]** ${preview}\n   📅 ${time} | Status: ${p.status} ${tags}`;
      });

      return `📅 **"${plan.theme}" — ${plan.posts.length} Posts:**\n\n${lines.join('\n\n')}\n\n👉 [View Full Plan](/content-planner) to approve and publish.`;
    }
  },

  create_content_plan: {
    definition: {
      type: 'function',
      function: {
        name: 'create_content_plan',
        description: "Generate a complete AI-powered multi-day content plan for the user's connected platforms. The AI schedules posts at the preferred time across all selected platforms.",
        parameters: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'The user\'s content goal or campaign description (e.g. "Grow brand awareness with educational AI content for 7 days posting daily at 9am").' },
            durationDays: { type: 'number', description: 'Number of days to plan (default 7, max 30).' },
            tone: { type: 'string', enum: ['professional', 'casual', 'educational', 'inspirational', 'hype'], description: 'Content tone.' }
          },
          required: ['prompt']
        },
      },
    },
    handler: async (args, context) => {
      const connections = await prisma.socialConnection.findMany({
        where: { workspaceId: context.workspaceId, isActive: true },
        select: { platform: true }
      });

      if (!connections.length) {
        return `⚠️ You have no connected social accounts. Please [connect your platforms](/connections) first before generating a content plan.`;
      }

      const platforms = [...new Set(connections.map((c: any) => c.platform))];
      const durationDays = Math.min(args.durationDays || 7, 30);

      return `🚀 **Ready to generate your content plan!**\n\n**Your prompt:** "${args.prompt}"\n**Duration:** ${durationDays} days\n**Tone:** ${args.tone || 'professional'}\n**Platforms:** ${platforms.join(', ')}\n\n👉 [Open Content Planner](/content-planner) to generate this plan. Copy and paste your prompt there to get started.\n\n💡 The Content Planner will generate ${durationDays * platforms.length} posts, scheduled at your preferred times across all your platforms!`;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TREND ENGINE
  // ─────────────────────────────────────────────────────────────────────────

  get_trending_topics: {
    definition: {
      type: 'function',
      function: {
        name: 'get_trending_topics',
        description: 'Get current trending topics from the Trend Engine. Optionally filter by platform or category. Returns hot topics with engagement scores and viral probability.',
        parameters: {
          type: 'object',
          properties: {
            platform: { type: 'string', description: 'Filter by platform (e.g. twitter, instagram, tiktok, linkedin, youtube, reddit). Omit for all platforms.' },
            category: { type: 'string', description: 'Filter by topic category (e.g. Technology, Business, Entertainment, Sports, Health, Politics).' },
            status: { type: 'string', enum: ['Viral', 'Hot', 'Rising', 'Emerging'], description: 'Filter by trend status.' },
            limit: { type: 'number', description: 'Number of trends to return (default 10, max 20).' }
          },
          required: []
        },
      },
    },
    handler: async (args, context) => {
      const limit = Math.min(args.limit || 10, 20);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);

      const where: any = {
        isNsfw: false, isBlacklisted: false, isFlagged: false,
        createdAt: { gte: cutoff }
      };
      if (args.platform) where.platform = args.platform.toLowerCase();
      if (args.category) where.category = { contains: args.category, mode: 'insensitive' };
      if (args.status) where.trendStatus = args.status;

      const trends = await (prisma as any).trend.findMany({
        where,
        orderBy: [{ score: 'desc' }, { viralProbability: 'desc' }],
        take: limit,
        select: { id: true, topic: true, platform: true, category: true, trendStatus: true, score: true, viralProbability: true, growthRate: true, sentiment: true, country: true }
      });

      if (!trends.length) {
        return `No trending topics found${args.platform ? ` for ${args.platform}` : ''}${args.category ? ` in ${args.category}` : ''}.\n\n💡 Visit [Trend Engine](/trends) to refresh trends or adjust filters.`;
      }

      const statusEmoji: Record<string, string> = { Viral: '🔥🔥', Hot: '🔥', Rising: '📈', Emerging: '🌱' };

      const lines = trends.map((t: any, i: number) => {
        const emoji = statusEmoji[t.trendStatus] || '📊';
        const loc = t.country && t.country !== 'Global' ? ` 📍${t.country}` : '';
        return `${i + 1}. ${emoji} **${t.topic}** [${t.platform.toUpperCase()}]\n   Score: ${t.score} | Viral Probability: ${t.viralProbability?.toFixed(0) || 0}% | Status: **${t.trendStatus}** | Category: ${t.category || 'General'}${loc}`;
      });

      const filterDesc = [
        args.platform ? `Platform: ${args.platform.toUpperCase()}` : '',
        args.category ? `Category: ${args.category}` : '',
        args.status ? `Status: ${args.status}` : ''
      ].filter(Boolean).join(' | ');

      return `📈 **Trending Topics${filterDesc ? ` (${filterDesc})` : ''}:**\n\n${lines.join('\n\n')}\n\n💡 Say "create a post about [topic]" to generate content for any trending topic! Or visit [Trend Engine](/trends) for full analysis.`;
    }
  },

  get_trend_opportunities: {
    definition: {
      type: 'function',
      function: {
        name: 'get_trend_opportunities',
        description: 'Get trending topics with high viral probability AND low competition — the best opportunities to jump on right now. These are emerging trends before they peak.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async (args, context) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 3);

      const trends = await (prisma as any).trend.findMany({
        where: {
          isNsfw: false, isBlacklisted: false, isFlagged: false,
          viralProbability: { gte: 40 },
          competitionLevel: { lte: 0.45 },
          trendStatus: { in: ['Emerging', 'Rising', 'Hot'] },
          createdAt: { gte: cutoff },
        },
        orderBy: [{ viralProbability: 'desc' }, { competitionLevel: 'asc' }],
        take: 8,
        select: { id: true, topic: true, platform: true, category: true, trendStatus: true, viralProbability: true, competitionLevel: true, growthRate: true }
      });

      if (!trends.length) return '🌱 No high-opportunity trends found right now. Check back soon or visit [Trend Engine](/trends) to refresh.';

      const lines = trends.map((t: any, i: number) => {
        const competition = t.competitionLevel < 0.2 ? '🟢 Very Low' : t.competitionLevel < 0.35 ? '🟡 Low' : '🟠 Moderate';
        return `${i + 1}. 🎯 **${t.topic}** [${t.platform.toUpperCase()}]\n   Viral Probability: **${t.viralProbability?.toFixed(0) || 0}%** | Competition: ${competition} | Status: ${t.trendStatus} | Category: ${t.category || 'General'}`;
      });

      return `🎯 **Top Trend Opportunities (High Viral, Low Competition):**\n\n${lines.join('\n\n')}\n\n💡 These are the best trends to create content on RIGHT NOW before they peak. Ask me to create a post for any of these!`;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AI PROFILE (Intelligence Profile)
  // ─────────────────────────────────────────────────────────────────────────

  get_ai_profile: {
    definition: {
      type: 'function',
      function: {
        name: 'get_ai_profile',
        description: "Get the user's AI Intelligence Profile — their niche, target audience, content pillars, tone preference, goals, avoided topics, brand keywords, and profile completeness score.",
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async (args, context) => {
      const profile = await prisma.userIntelligenceProfile.findUnique({
        where: { userId: context.userId }
      });

      if (!profile) {
        return `🤖 You don't have an AI Profile set up yet.\n\n👉 Go to [AI Profile](/ai-profile) to build your profile. The AI will use it to personalize ALL content it creates for you — matching your voice, targeting your audience, and aligning with your goals.\n\nOnce set up, I'll know exactly how to write for your brand!`;
      }

      const ta = profile.targetAudience as any;
      const goals = profile.goals as any;
      const pp = profile.postingPreferences as any;

      const sections = [
        `🤖 **Your AI Intelligence Profile** (Completeness: **${profile.completenessScore || 0}%**)`,
        '',
        profile.niche ? `🎯 **Niche/Industry:** ${profile.niche}` : '',
        ta?.demographics ? `👥 **Target Audience:** ${ta.demographics}` : '',
        ta?.painPoints?.length ? `😓 **Audience Pain Points:** ${ta.painPoints.join(', ')}` : '',
        ta?.aspirations?.length ? `✨ **Audience Aspirations:** ${ta.aspirations.join(', ')}` : '',
        profile.contentPillars?.length ? `📌 **Content Pillars:** ${profile.contentPillars.join(', ')}` : '',
        profile.tonePreference ? `🎙️ **Preferred Tone:** ${profile.tonePreference}` : '',
        goals?.primary ? `🎯 **Primary Goal:** ${goals.primary}` : '',
        goals?.secondary ? `🔄 **Secondary Goal:** ${goals.secondary}` : '',
        profile.avoidedTopics?.length ? `⚠️ **Avoided Topics:** ${profile.avoidedTopics.join(', ')}` : '',
        profile.brandKeywords?.length ? `🏷️ **Brand Keywords:** ${profile.brandKeywords.join(', ')}` : '',
        pp?.frequency ? `📅 **Posting Frequency:** ${pp.frequency}` : '',
      ].filter(Boolean);

      const completeness = profile.completenessScore || 0;
      const tip = completeness < 50
        ? '\n\n⚠️ Your profile is incomplete. Visit [AI Profile](/ai-profile) to fill it out — the more complete it is, the better I can personalize your content!'
        : completeness < 80
        ? '\n\n💡 Good progress! Fill in more details in [AI Profile](/ai-profile) to get even better personalized content.'
        : '\n\n✅ Great profile! I\'ll use this to personalize all content I create for you.';

      return sections.join('\n') + tip;
    }
  },

  get_voice_model: {
    definition: {
      type: 'function',
      function: {
        name: 'get_voice_model',
        description: "Get the user's AI Voice Model — the brand voice characteristics learned from analyzing their past content (formality, energy, emoji usage, CTA style, hashtag patterns).",
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async (args, context) => {
      const voice = await prisma.userVoiceModel.findUnique({
        where: { userId: context.userId }
      });

      if (!voice) {
        return `🎙️ You don't have an AI Voice Model yet.\n\n👉 Go to [AI Profile](/ai-profile) → Voice Model section to train the AI on your writing style. Once trained, I'll mirror your brand voice in every post I create!`;
      }

      if (voice.confidenceScore < 0.2) {
        return `🎙️ Your Voice Model exists but has low confidence (**${(voice.confidenceScore * 100).toFixed(0)}%**) — only ${voice.samplesAnalyzed} samples analyzed. Go to [AI Profile](/ai-profile) and add more content samples for better voice learning.`;
      }

      const formalityLabel = voice.formalityScore < 0.3 ? 'Very Casual' : voice.formalityScore < 0.5 ? 'Casual' : voice.formalityScore < 0.7 ? 'Professional' : 'Formal';
      const energyLabel = voice.energyScore < 0.3 ? 'Calm & Measured' : voice.energyScore < 0.5 ? 'Moderate' : voice.energyScore < 0.7 ? 'Energetic' : 'High Energy';
      const hp = voice.hashtagPatterns as any;
      const vs = voice.vocabularySamples as any;

      const lines = [
        `🎙️ **Your Brand Voice Model** (Confidence: **${(voice.confidenceScore * 100).toFixed(0)}%** from ${voice.samplesAnalyzed} samples)`,
        '',
        `🎭 **Formality:** ${formalityLabel} (${(voice.formalityScore * 100).toFixed(0)}%)`,
        `⚡ **Energy:** ${energyLabel} (${(voice.energyScore * 100).toFixed(0)}%)`,
        voice.avgSentenceLength ? `📝 **Avg Sentence Length:** ~${Math.round(voice.avgSentenceLength)} words` : '',
        voice.emojiUsageRate ? `😊 **Emoji Usage:** ~${voice.emojiUsageRate.toFixed(1)} per 100 words` : '',
        voice.ctaStyle ? `📣 **CTA Style:** ${voice.ctaStyle}` : '',
        hp?.avgCount ? `#️⃣ **Hashtag Usage:** ~${hp.avgCount} per post` : '',
        hp?.preferred?.length ? `🏷️ **Preferred Hashtags:** ${hp.preferred.slice(0, 5).join(', ')}` : '',
        vs?.preferredWords?.length ? `💬 **Signature Vocabulary:** "${vs.preferredWords.slice(0, 5).join('", "')}"` : '',
      ].filter(Boolean);

      return lines.join('\n') + '\n\n✅ I\'ll match this voice in all content I create for you!';
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PERFORMANCE INTELLIGENCE
  // ─────────────────────────────────────────────────────────────────────────

  get_performance_intelligence: {
    definition: {
      type: 'function',
      function: {
        name: 'get_performance_intelligence',
        description: "Get the user's performance intelligence summary — top performing content types, engagement snapshots, strategy recommendations, and competitor benchmarks.",
        parameters: {
          type: 'object',
          properties: {
            section: {
              type: 'string',
              enum: ['overview', 'top_content', 'recommendations', 'competitors', 'snapshots'],
              description: 'Which section to retrieve. Defaults to overview (all sections).'
            }
          },
          required: []
        },
      },
    },
    handler: async (args, context) => {
      const section = args.section || 'overview';
      const parts: string[] = [];

      // Top Performing Content
      if (section === 'overview' || section === 'top_content') {
        const topContent = await prisma.userEngagementHistory.findMany({
          where: { userId: context.userId, snapshotType: '7d', reach: { gt: 0 } },
          orderBy: { engagementRate: 'desc' },
          take: 5,
          select: { contentType: true, topic: true, engagementRate: true, reach: true }
        });

        if (topContent.length) {
          const lines = topContent.map((c, i) =>
            `  ${i + 1}. **${c.contentType || 'Content'}** about "${c.topic || 'general'}" → **${c.engagementRate.toFixed(1)}%** engagement | ${(c.reach || 0).toLocaleString()} reach`
          );
          parts.push(`🏆 **Top Performing Content (Last 7 Days):**\n${lines.join('\n')}`);
        } else {
          parts.push('🏆 **Top Performing Content:** No engagement data yet. Publish posts and allow time for analytics to populate.');
        }
      }

      // Weekly Snapshots
      if (section === 'overview' || section === 'snapshots') {
        const snapshots = await prisma.userEngagementSnapshot.findMany({
          where: { userId: context.userId },
          orderBy: { weekStart: 'desc' },
          take: 4,
          select: { weekStart: true, avgEngRate: true, totalReach: true, totalPosts: true }
        });

        if (snapshots.length) {
          const lines = snapshots.map(s => {
            const week = new Date(s.weekStart).toLocaleDateString();
            return `  • Week of ${week}: Avg Eng Rate **${s.avgEngRate.toFixed(1)}%** | Reach: ${(s.totalReach || 0).toLocaleString()} | Posts: ${s.totalPosts}`;
          });
          parts.push(`📊 **Weekly Engagement Snapshots:**\n${lines.join('\n')}`);
        }
      }

      // Recommendations
      if (section === 'overview' || section === 'recommendations') {
        const recs = await prisma.userStrategyRecommendation.findMany({
          where: {
            userId: context.userId,
            status: 'pending',
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          },
          orderBy: { priority: 'desc' },
          take: 5,
          select: { title: true, body: true, priority: true, type: true }
        });

        if (recs.length) {
          const lines = recs.map((r, i) => {
            const priorityEmoji = r.priority >= 8 ? '🔴' : r.priority >= 5 ? '🟡' : '🟢';
            return `  ${i + 1}. ${priorityEmoji} **${r.title}**${r.body ? `\n     ${r.body}` : ''}`;
          });
          parts.push(`💡 **Strategy Recommendations:**\n${lines.join('\n')}`);
        } else {
          parts.push('💡 **Strategy Recommendations:** No active recommendations. Post more content to get AI-powered strategy insights.');
        }
      }

      // Competitor Benchmarks
      if (section === 'overview' || section === 'competitors') {
        const competitors = await prisma.competitorAccount.findMany({
          where: { userId: context.userId },
          select: { handle: true, platform: true, avgEngRate: true, followerCount: true }
        });

        if (competitors.length) {
          const competitorAvg = competitors.reduce((sum, c) => sum + (c.avgEngRate || 0), 0) / competitors.length;
          const userSnapshots = await prisma.userEngagementSnapshot.findMany({
            where: { userId: context.userId },
            orderBy: { weekStart: 'desc' },
            take: 4,
            select: { avgEngRate: true }
          });
          const userAvg = userSnapshots.length > 0
            ? userSnapshots.reduce((sum, s) => sum + s.avgEngRate, 0) / userSnapshots.length
            : 0;

          const comparison = userAvg > competitorAvg ? `✅ ${(userAvg - competitorAvg).toFixed(1)}% ABOVE` : `⚠️ ${(competitorAvg - userAvg).toFixed(1)}% BELOW`;
          const compLines = competitors.map(c =>
            `  • @${c.handle} [${c.platform.toUpperCase()}] — ${(c.avgEngRate || 0).toFixed(1)}% avg eng rate | ${(c.followerCount || 0).toLocaleString()} followers`
          );
          parts.push(`🏆 **Competitor Benchmarks:**\nYour avg engagement (**${userAvg.toFixed(1)}%**) is ${comparison} competitor average (**${competitorAvg.toFixed(1)}%**).\n\nTracked competitors:\n${compLines.join('\n')}`);
        } else {
          parts.push('🏆 **Competitor Benchmarks:** No competitors tracked yet. Visit [Performance Intelligence](/performance) to add competitors to benchmark against.');
        }
      }

      if (!parts.length) return 'No performance data available yet. Publish posts and return here as your analytics grow!';

      return parts.join('\n\n') + '\n\n👉 Visit [Performance Intelligence](/performance) for full charts and detailed analysis.';
    }
  },

  get_strategy_recommendations: {
    definition: {
      type: 'function',
      function: {
        name: 'get_strategy_recommendations',
        description: "Get AI-generated strategy recommendations for improving the user's social media performance — posting frequency, content type mix, best times to post, etc.",
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['posting_time', 'content_mix', 'engagement', 'growth', 'platform'], description: 'Filter by recommendation type.' }
          },
          required: []
        },
      },
    },
    handler: async (args, context) => {
      const where: any = {
        userId: context.userId,
        status: 'pending',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      };
      if (args.type) where.type = args.type;

      const recs = await prisma.userStrategyRecommendation.findMany({
        where,
        orderBy: { priority: 'desc' },
        take: 8,
        select: { id: true, title: true, body: true, type: true, priority: true }
      });

      if (!recs.length) {
        return `💡 No strategy recommendations available right now${args.type ? ` for "${args.type}"` : ''}.\n\nVisit [Performance Intelligence](/performance) to run an analysis and generate fresh recommendations based on your recent content performance.`;
      }

      const typeEmoji: Record<string, string> = {
        posting_time: '⏰', content_mix: '🎨', engagement: '💬', growth: '📈', platform: '📱'
      };

      const lines = recs.map((r, i) => {
        const emoji = typeEmoji[r.type] || '💡';
        const priorityLabel = r.priority >= 8 ? '🔴 High' : r.priority >= 5 ? '🟡 Medium' : '🟢 Low';
        return `${i + 1}. ${emoji} **${r.title}** [${priorityLabel}]\n   ${r.body || ''}`;
      });

      return `💡 **Strategy Recommendations (${recs.length} active):**\n\n${lines.join('\n\n')}\n\n👉 [Performance Intelligence](/performance) to act on these insights.`;
    }
  },
};

