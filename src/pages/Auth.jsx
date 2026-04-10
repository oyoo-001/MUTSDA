import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { apiClient, SOCKET_URL } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Church } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { GoogleLogin } from '@react-oauth/google';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, checkUserAuth, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpVerified, setOtpVerified] = useState(false);
  const [verifiedResetData, setVerifiedResetData] = useState({ email: '', otp: '' });
  const emailResetRef = useRef(null);
  const otpInputRef = useRef(null);

  const returnUrlParam = new URLSearchParams(location.search).get('returnUrl');
  const safeReturnUrl = returnUrlParam && returnUrlParam.startsWith('/') ? returnUrlParam : null;
  const stateFrom = location.state?.from;
  const from = typeof stateFrom === 'string'
    ? stateFrom
    : (stateFrom?.pathname || safeReturnUrl || '/');
  const view = new URLSearchParams(location.search).get('view') || 'login';
  const emailParam = new URLSearchParams(location.search).get('email') || '';

  // If user is already authenticated, redirect them away from auth page
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timerId = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [resendCooldown]);

  // Reset OTP verification status when view changes
  useEffect(() => {
    if (view !== 'reset-password') {
      setOtpVerified(false);
      setVerifiedResetData({ email: '', otp: '' });
    }
  }, [view]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const credentials = Object.fromEntries(formData.entries());

    try {
      await login(credentials);
      toast({
        variant: "success",
        title: "Login successful!",
        description: "Redirecting...",
      });
      await checkUserAuth();
      navigate(from, { replace: true });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Invalid email or password.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());

    if (data.password !== data.confirm_password) {
      toast({
        variant: "warning",
        title: "Warning",
        description: "Passwords do not match.",
      });
      setLoading(false);
      return;
    }

    try {
      // Assumes an `apiClient.auth.register` method is available for public sign-ups.
      await apiClient.auth.register({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
      });
      toast({
        variant: "success",
        title: "Registration successful!",
        description: "Please sign in.",
      });
      navigate('/auth?view=login', { replace: true });
    } catch (error) {
      const errorMessage = error.message || 'Registration failed. The email might already be in use.';
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email');

    try {
      await apiClient.auth.forgotPassword(email);
      toast({
        variant: "success",
        title: "Request Sent",
        description: "OTP sent to your email.",
      });
      navigate(`/auth?view=reset-password&email=${encodeURIComponent(email)}`, { replace: true });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to send reset link.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const email = emailResetRef.current?.value;
    if (!email) {
      toast({ variant: "warning", title: "Warning", description: "Email is required to resend OTP." });
      return;
    }
    setResending(true);
    try {
      await apiClient.auth.forgotPassword(email);
      toast({
        variant: "success",
        title: "Request Sent",
        description: "A new OTP has been sent to your email.",
      });
      setResendCooldown(30);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to send OTP.',
      });
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const email = emailResetRef.current?.value;
    const otp = otpInputRef.current?.value;

    if (!email || !otp) {
      toast({ variant: "warning", title: "Warning", description: "Email and OTP are required." });
      return;
    }
    setLoading(true);
    try {
      await apiClient.auth.verifyOtp({ email, otp });
      toast({
        variant: "success",
        title: "OTP Verified",
        description: "You can now set a new password.",
      });
      setVerifiedResetData({ email, otp });
      setOtpVerified(true);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message || 'Failed to verify OTP.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());

    if (data.password !== data.confirm_password) {
      toast({ variant: "warning", title: "Warning", description: "Passwords do not match." });
      setLoading(false);
      return;
    }

    try {
      await apiClient.auth.resetPassword({
        email: verifiedResetData.email,
        otp: verifiedResetData.otp,
        password: data.password
      });
      toast({
        variant: "success",
        title: "Password Reset Successful",
        description: "Please sign in with your new password.",
      });
      // Reset state
      setOtpVerified(false);
      setVerifiedResetData({ email: '', otp: '' });
      navigate('/auth?view=login', { replace: true });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message || 'Failed to reset password.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      // Use SOCKET_URL as base if available, or relative path
      const baseUrl = typeof SOCKET_URL !== 'undefined' ? SOCKET_URL : 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        toast({ variant: "success", title: "Login successful!", description: "Redirecting..." });
        await checkUserAuth();
        navigate(from, { replace: true });
      } else {
        throw new Error(data.message || 'Google login failed');
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f2] p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-full bg-[#ffff] flex items-center justify-center group-hover:scale-105 transition-transform">
             <img src="https://res.cloudinary.com/dxzmo0roe/image/upload/v1772699359/seventh-day-adventist-church-seeklogo_abaiug.png" alt="Church Icon" className="w-12 h-12" />
            </div>
            <div className="text-left">
              <h1 className="text-lg font-bold text-[#1a2744] leading-tight">MUTSDA</h1>
              <p className="text-xs text-[#c8a951] font-medium tracking-wider uppercase">Seventh-Day Adventist</p>
            </div>
          </Link>
        </div>

        <Tabs value={view} className="w-full" onValueChange={(value) => navigate(`/auth?view=${value}`, { replace: true })}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-200">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Create Account</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <Card className="border-t-0 rounded-t-none">
              <CardHeader className="text-center">
                <CardTitle className="font-serif text-2xl text-[#1a2744]">Welcome Back</CardTitle>
                <CardDescription>Enter your credentials to access your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" placeholder="member@email.com" required /></div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="password">Password</Label>
                      <Link to="/auth?view=forgot-password" className="text-xs text-gray-500 hover:underline hover:text-[#1a2744]">
                        Forgot Password?
                      </Link>
                    </div>
                    <Input id="password" name="password" type="password" required />
                  </div>
                  <Button type="submit" className="w-full bg-[#1a2744] hover:bg-[#2d5f8a] text-white font-semibold" disabled={loading}>{loading ? 'Signing In...' : 'Sign In'}</Button>
                </form>
                
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">Or continue with</span></div>
                </div>
                
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => {
                      toast({ variant: "destructive", title: "Login Failed", description: "Google login was unsuccessful." });
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card className="border-t-0 rounded-t-none">
              <CardHeader className="text-center">
                <CardTitle className="font-serif text-2xl text-[#1a2744]">Create an Account</CardTitle>
                <CardDescription>Join our church community online.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1.5"><Label htmlFor="full_name">Full Name</Label><Input id="full_name" name="full_name" placeholder="John Doe" required /></div>
                  <div className="space-y-1.5"><Label htmlFor="email-signup">Email</Label><Input id="email-signup" name="email" type="email" placeholder="member@email.com" required /></div>
                  <div className="space-y-1.5"><Label htmlFor="password-signup">Password</Label><Input id="password-signup" name="password" type="password" required /></div>
                  <div className="space-y-1.5"><Label htmlFor="confirm_password">Confirm Password</Label><Input id="confirm_password" name="confirm_password" type="password" required /></div>
                  <Button type="submit" className="w-full bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] font-semibold" disabled={loading}>{loading ? 'Creating Account...' : 'Create Account'}</Button>
                </form>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">Or continue with</span></div>
                </div>
                
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => {
                      toast({ variant: "destructive", title: "Login Failed", description: "Google login was unsuccessful." });
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forgot-password">
            <Card className="border-t-0 rounded-t-none">
              <CardHeader className="text-center">
                <CardTitle className="font-serif text-2xl text-[#1a2744]">Forgot Password</CardTitle>
                <CardDescription>Enter your email to receive an OTP.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email-forgot">Email</Label>
                    <Input id="email-forgot" name="email" type="email" placeholder="member@email.com" required />
                  </div>
                  <Button type="submit" className="w-full bg-[#1a2744] hover:bg-[#2d5f8a] text-white font-semibold" disabled={loading}>
                    {loading ? 'Sending...' : 'Send OTP'}
                  </Button>
                  <div className="text-center pt-2">
                    <Link to="/auth?view=login" className="text-sm text-gray-600 hover:underline">Back to Sign In</Link>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reset-password">
            <Card className="border-t-0 rounded-t-none">
              <CardHeader className="text-center">
                <CardTitle className="font-serif text-2xl text-[#1a2744]">Reset Password</CardTitle>
                <CardDescription>
                  {otpVerified ? 'Set your new password.' : 'First, enter the OTP sent to your email to verify your identity.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!otpVerified ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email-reset">Email</Label>
                      <Input ref={emailResetRef} id="email-reset" name="email" type="email" defaultValue={emailParam} required />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="otp">OTP Code</Label>
                        <Button
                          type="button"
                          variant="link"
                          className="text-xs h-auto p-0 text-[#1a2744] hover:text-[#2d5f8a]"
                          onClick={handleResendOtp}
                          disabled={resending || resendCooldown > 0}
                        >
                          {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                        </Button>
                      </div>
                      <Input ref={otpInputRef} id="otp" name="otp" placeholder="123456" required />
                    </div>
                    <Button onClick={handleVerifyOtp} className="w-full bg-[#1a2744] hover:bg-[#2d5f8a] text-white font-semibold" disabled={loading || resending}>
                      {loading ? 'Verifying...' : 'Verify OTP'}
                    </Button>
                    <div className="text-center pt-2">
                      <Link to="/auth?view=login" className="text-sm text-gray-600 hover:underline">Back to Sign In</Link>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email-reset-verified">Email</Label>
                      <Input id="email-reset-verified" name="email" type="email" value={verifiedResetData.email} readOnly disabled />
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="new-password">New Password</Label><Input id="new-password" name="password" type="password" required /></div>
                    <div className="space-y-1.5"><Label htmlFor="confirm-new-password">Confirm Password</Label><Input id="confirm-new-password" name="confirm_password" type="password" required /></div>
                    <Button type="submit" className="w-full bg-[#1a2744] hover:bg-[#2d5f8a] text-white font-semibold" disabled={loading}>
                      {loading ? 'Resetting...' : 'Reset Password'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <p className="px-8 text-center text-sm text-gray-500 mt-6">By creating an account, you agree to our terms of service and privacy policy.</p>
      </div>
    </div>
  );
}