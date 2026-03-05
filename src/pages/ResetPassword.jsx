import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Church } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleResetPassword = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast({
        variant: "warning",
        title: "Warning",
        description: "Passwords do not match.",
      });
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.auth.resetPassword(token, password);
      toast({
        variant: "success",
        title: "Success!",
        description: response.message,
      });
      navigate('/auth?view=login');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to reset password. The link may be invalid or expired.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f2] p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-full bg-[#1a2744] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Church className="w-6 h-6 text-[#c8a951]" />
            </div>
            <div className="text-left">
              <h1 className="text-lg font-bold text-[#1a2744] leading-tight">MUTSDA</h1>
              <p className="text-xs text-[#c8a951] font-medium tracking-wider uppercase">Seventh-Day Adventist</p>
            </div>
          </Link>
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="font-serif text-2xl text-[#1a2744]">Set a New Password</CardTitle>
            <CardDescription>Enter and confirm your new password below.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                <Input id="confirm-new-password" name="confirm_password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full bg-[#1a2744] hover:bg-[#2d5f8a] text-white font-semibold" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}