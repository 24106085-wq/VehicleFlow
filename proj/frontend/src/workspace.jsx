import { createContext, useContext } from 'react';

// Two workspaces share the same pages but live under separate URL prefixes.
export const WORKSPACES = {
  customer: { key: 'customer', base: '/customer', roles: ['customer'], label: 'Customer Portal' },
  admin: { key: 'admin', base: '/admin', roles: ['admin', 'mechanic'], label: 'Admin & Agile Workspace' },
};
export const homeFor = (user) => (user ? (user.role === 'customer' ? WORKSPACES.customer : WORKSPACES.admin).base : '/');

const Ctx = createContext(WORKSPACES.customer);
export const WorkspaceProvider = Ctx.Provider;
export const useWorkspace = () => useContext(Ctx);
// Prefix an in-workspace path, e.g. useBase()('/vehicles') -> '/customer/vehicles'
export const useBase = () => { const { base } = useWorkspace(); return (p = '/') => (p === '/' ? base : base + p); };
