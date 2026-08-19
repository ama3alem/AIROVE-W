'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Tabs } from '@/components/ui';
import { LoadingSpinner } from '@/lib/utils';

export default function SettingsPage() {
  const { session, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'security', label: 'Security' },
    { key: 'ai_preferences', label: 'AI Preferences' },
  ];

  if (loading) {
    return (
      <div className="page-container">
      <PageHeader 
        breadcrumbs={[{ label: 'Governance', href: '/settings' }, { label: 'Settings' }]}
        title="User & Command Center Settings" 
        subtitle="Account profile, preferences, and AI configurations" 
      />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      <Card>
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        <div className="p-5">
          {activeTab === 'profile' && <ProfileTab session={session} />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'ai_preferences' && <AIPreferencesTab />}
        </div>
      </Card>
    </div>
  );
}

function ProfileTab({ session }: { session: ReturnType<typeof useAuth>['session'] }) {
  if (!session) return null;
  const { user, membership } = session;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-500">Display Name</label>
              <p className="mt-1 text-sm text-gray-900">{user.name ?? '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Email</label>
              <p className="mt-1 text-sm text-gray-900">{user.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Platform Role</label>
              <p className="mt-1 text-sm text-gray-900">{user.platformRole ?? '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Organization Role</label>
              <p className="mt-1 text-sm text-gray-900">{membership?.role ?? '-'}</p>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function NotificationsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-gray-500">
          Notification preferences will be available in a future update. Currently, you can manage
          notifications from the Notifications page.
        </p>
      </CardBody>
    </Card>
  );
}

function SecurityTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Settings</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-gray-500">
          Security settings such as password changes and two-factor authentication will be available
          in a future update.
        </p>
      </CardBody>
    </Card>
  );
}

function AIPreferencesTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Preferences</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-gray-500">
          AI preferences are managed by your organization administrator. Contact your admin to
          modify AI assistant settings, model selection, and behavior configuration.
        </p>
      </CardBody>
    </Card>
  );
}
