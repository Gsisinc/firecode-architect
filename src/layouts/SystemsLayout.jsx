import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import SystemsAppShell from '@/components/systems/SystemsAppShell';

export default function SystemsLayout() {
  const [search, setSearch] = useState('');
  return (
    <SystemsAppShell searchValue={search} onSearchChange={setSearch}>
      <Outlet context={{ search }} />
    </SystemsAppShell>
  );
}
