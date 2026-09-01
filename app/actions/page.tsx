import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { ActionWorkspace } from '@/components/actions/action-workspace';
import { Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getActionItemStore } from '@/lib/actions/store';
import { toWorkspaceActions } from '@/lib/actions/serialize';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Action workspace'),
  description: BRAND.description,
  robots: { index: false, follow: false },
};

export default async function ActionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/actions'));

  const store = await getActionItemStore();
  const actions = await toWorkspaceActions(user.id, await store.listForUser(user.id));

  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="mx-auto max-w-[var(--container-content)] px-5 py-12 md:py-16"
      >
        <Meta>Action workspace</Meta>
        <h1 className="font-display text-text mt-3 text-[32px] leading-tight md:text-[40px]">
          What happens next.
        </h1>
        <p className="text-text-muted measure mt-3 text-[15px] leading-relaxed">
          Every report&rsquo;s recommendations can land here as editable actions —
          re-phase them, assign them, complete them, or delete the ones that do not fit.
          Each one keeps a link back to the finding that produced it.
        </p>

        <div className="mt-10">
          {actions.length === 0 ? (
            <div className="border-rule border p-8 text-center">
              <p className="text-text text-[15px]">Nothing here yet.</p>
              <p className="text-text-muted measure mx-auto mt-2 text-[14px] leading-relaxed">
                Open a finished report and choose “Add this report&rsquo;s plan to my
                workspace”, or add an action by hand below once one exists.
              </p>
            </div>
          ) : null}
          <ActionWorkspace initialActions={actions} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
