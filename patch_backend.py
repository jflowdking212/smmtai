import sys
import re

def patch_auth_service():
    path = '/home/jbliss/sites/smmt/apps/api/src/services/auth.service.ts'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'async switchWorkspace' in content:
        print('auth.service.ts already patched')
        return

    new_method = """
  async switchWorkspace(userId: string, targetWorkspaceId: string) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: targetWorkspaceId } },
    });
    if (!membership || membership.status !== 'active') {
      throw new AppError('You are not an active member of this workspace', 403, 'FORBIDDEN');
    }

    const tokens = this.generateTokenPair(userId, targetWorkspaceId);
    await this.storeRefreshToken(userId, tokens.refreshToken);

    const { role, tier } = await this.getWorkspaceContext(userId, targetWorkspaceId);

    return {
      workspaceId: targetWorkspaceId,
      role,
      tier,
      ...tokens,
    };
  }
"""
    content = content.replace('export class AuthService {', 'export class AuthService {' + new_method)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Patched auth.service.ts')

def patch_auth_route():
    path = '/home/jbliss/sites/smmt/apps/api/src/routes/auth.ts'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if '/switch-workspace' in content:
        print('auth.ts already patched')
        return

    new_route = """
// Switch workspace
authRouter.post(
  '/switch-workspace',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const targetWorkspaceId = req.body.workspaceId;
      if (!targetWorkspaceId) {
         return res.status(400).json({ success: false, error: { message: 'workspaceId required' }});
      }
      const result = await authService.switchWorkspace(req.userId!, targetWorkspaceId);
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
      res.json({
        success: true,
        data: {
          workspaceId: result.workspaceId,
          accessToken: result.accessToken,
          role: result.role,
          tier: result.tier,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);
"""
    content = content.replace('// Get current user', new_route + '\n// Get current user')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Patched auth.ts')

def patch_api():
    path = '/home/jbliss/sites/smmt/apps/web/src/lib/api.ts'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'switchWorkspace:' in content:
        print('api.ts already patched')
        return

    switch_fn = """
    switchWorkspace: (workspaceId: string) =>
      request<{ success: true; data: { workspaceId: string; accessToken: string; role: WorkspaceRole; tier: SubscriptionTier } }>('/auth/switch-workspace', {
        method: 'POST',
        body: JSON.stringify({ workspaceId }),
      }),"""
    
    content = content.replace('logout: () => request(\'/auth/logout\', { method: \'POST\' }),', 'logout: () => request(\'/auth/logout\', { method: \'POST\' }),' + switch_fn)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Patched api.ts')

patch_auth_service()
patch_auth_route()
patch_api()
