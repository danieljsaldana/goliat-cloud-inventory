import HomePage from '../../features/home/HomePage/index.jsx';
import DashboardPage from '../../features/inventory/DashboardPage/index.jsx';
import NotFound from '../../components/ui/NotFound/index.jsx';
import AdministrationPage from '../../features/administration/AdministrationPage.jsx';
import ArchitecturePage from '../../features/architecture/ArchitecturePage/index.jsx';
import MembersPage from '../../features/members/MembersPage.jsx';
import ProfilePage from '../../features/auth/ProfilePage/index.jsx';
import FinOpsPage from '../../features/finops/FinOpsPage/index.jsx';

export default function RouteContent({ route, inventory, subscription, setSubscription, access }) {
  const section = route[0];
  if (!section) return <HomePage inventory={inventory} />;
  if (section === 'architecture') return <ArchitecturePage />;
  if (section === 'finops')
    return <FinOpsPage inventory={inventory} setSubscription={setSubscription} />;
  if (section === 'profile')
    return access?.enabled ? <ProfilePage access={access} /> : <NotFound />;
  if (section === 'members') return access?.administrator ? <MembersPage /> : <NotFound />;
  if (section === 'admin')
    return access?.administrator ? <AdministrationPage inventory={inventory} /> : <NotFound />;
  if (section !== 'inventario') return <NotFound />;
  return (
    <DashboardPage
      key={section}
      provider="azure"
      reportId={route[1]}
      inventory={inventory}
      subscription={subscription}
      setSubscription={setSubscription}
    />
  );
}
