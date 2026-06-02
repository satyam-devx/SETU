import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
        <span className="text-3xl font-bold text-muted-foreground">?</span>
      </div>
      <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
        <Button asChild className="gap-2">
          <Link to="/"><Home className="w-4 h-4" /> SETU Home</Link>
        </Button>
      </div>
    </div>
  );
}
