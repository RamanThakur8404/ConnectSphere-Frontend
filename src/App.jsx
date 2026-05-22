import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import "./styles/global.css";

import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Feed from "@/pages/Feed";
import Explore from "@/pages/Explore";
import Search from "@/pages/Search";
import Notifications from "@/pages/Notifications";
import UserProfile from "@/pages/UserProfile";
import EditProfile from "@/pages/EditProfile";
import Settings from "@/pages/Settings";
import Bookmarks from "@/pages/Bookmarks";
import Messages from "@/pages/Messages";
import Payments from "@/pages/Payments";
import AdminDashboard from "@/pages/AdminDashboard";
import OAuth2Redirect from "@/pages/OAuth2Redirect";
import PostDetails from "@/pages/PostDetails";
import CreatePostPage from "@/pages/CreatePostPage";
import EditPost from "@/pages/EditPost";
import Stories from "@/pages/Stories";
import HashtagFeed from "@/pages/HashtagFeed";
import NotFound from "@/pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <Routes>
          {/* Public — accessible without login */}
          <Route path="/" element={<Index />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<OAuth2Redirect />} />

          {/* Public — viewable without login (like Instagram) */}
          <Route path="/feed" element={<Feed />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/search" element={<Search />} />
          <Route path="/posts/:postId" element={<PostDetails />} />
          <Route path="/users/:userId" element={<UserProfile />} />
          <Route path="/profile/:username" element={<UserProfile />} />
          <Route path="/hashtag/:tag" element={<HashtagFeed />} />
          <Route path="/stories" element={<Stories />} />

          {/* Protected — requires login to perform actions */}
          <Route element={<ProtectedRoute />}>
            <Route path="/post/create" element={<CreatePostPage />} />
            <Route path="/post/:postId/edit" element={<EditPost />} />
            <Route path="/profile/edit" element={<EditProfile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/payments" element={<Payments />} />
          </Route>

          {/* Admin — requires ADMIN or MODERATOR role */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/:adminTab" element={<AdminDashboard />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
