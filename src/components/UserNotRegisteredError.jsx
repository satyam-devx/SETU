import React from 'react';
import { Link } from 'react-router-dom';
import { UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UserNotRegisteredError() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
        <UserX className="w-8 h-8 text-destructive" />
      </div>
      <h1 className="text-xl font-bold text-foreground mb-2">Account Not Found</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Your account is not registered on SETU. Please contact your Village Anchor or register through the onboarding process.
      </p>
      <Button asChild>
        <Link to="/">Return to SETU</Link>
      </Button>
    </div>
  );
}
