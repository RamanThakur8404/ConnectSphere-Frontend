import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import {
  Orbit, SmilePlus, MessageCircle, MessagesSquare, Share2, UserRoundPlus,
  Hash, Clapperboard, BellRing, ImagePlus, LockKeyhole, Shield
} from "lucide-react";

export default function Index() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-white via-primary/5 to-accent/10 pt-16 pb-16 md:pb-0">
        <section className="container px-4 sm:px-6 py-12 sm:py-16 md:py-24 lg:py-32">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="space-y-6 md:space-y-8 text-center md:text-left">
              <div className="space-y-4">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                  <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Share Moments,</span>
                  <br /><span className="text-foreground">Build Connections</span>
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-lg mx-auto md:mx-0">
                  Connect with people who inspire you. Share your stories, discover trending moments, and build meaningful communities across the globe.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center md:justify-start">
                <Link to="/auth/signup"><Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white rounded-full px-8">Get Started</Button></Link>
                <Link to="/feed"><Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full px-8">Explore Feed</Button></Link>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center md:justify-start">
                <Shield className="w-4 h-4 flex-shrink-0" /><span>Safe, private, and secure community</span>
              </div>
            </div>
            <div className="relative mt-4 md:mt-0">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-3xl"></div>
              <div className="relative bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl border border-primary/10">
                <div className="space-y-4">
                  <div className="p-3 sm:p-4 border border-border rounded-xl sm:rounded-2xl space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex-shrink-0"></div>
                      <div className="min-w-0"><div className="font-semibold text-sm truncate">Sarah Chen</div><div className="text-xs text-muted-foreground">2 minutes ago</div></div>
                    </div>
                    <p className="text-sm">Just witnessed the most beautiful sunset! #MomentsCaptured</p>
                    <img
                      src="/images/landing-sunset.avif"
                      alt="Warm sunset over soft ocean waves"
                      className="w-full h-24 sm:h-32 rounded-lg object-cover"
                    />
                    <div className="flex gap-4 pt-2 text-xs text-muted-foreground">
                      <button type="button" className="flex items-center gap-1 hover:text-primary transition"><SmilePlus className="w-4 h-4" /> 234</button>
                      <button type="button" className="flex items-center gap-1 hover:text-primary transition"><MessageCircle className="w-4 h-4" /> 12</button>
                      <button type="button" className="flex items-center gap-1 hover:text-primary transition"><Share2 className="w-4 h-4" /> 8</button>
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 border border-border rounded-xl sm:rounded-2xl space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-secondary to-accent flex-shrink-0"></div>
                      <div className="min-w-0"><div className="font-semibold text-sm truncate">Marcus Dev</div><div className="text-xs text-muted-foreground">1 hour ago</div></div>
                    </div>
                    <p className="text-sm">Excited to announce my new project launch! #BuildingConnections</p>
                    <div className="flex gap-4 pt-2 text-xs text-muted-foreground">
                      <button type="button" className="flex items-center gap-1 hover:text-primary transition"><SmilePlus className="w-4 h-4" /> 512</button>
                      <button type="button" className="flex items-center gap-1 hover:text-primary transition"><MessageCircle className="w-4 h-4" /> 45</button>
                      <button type="button" className="flex items-center gap-1 hover:text-primary transition"><Share2 className="w-4 h-4" /> 89</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container px-4 sm:px-6 py-12 sm:py-16 md:py-24 lg:py-32">
          <div className="text-center space-y-3 sm:space-y-4 mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Powerful Features Built for Connection</h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">Everything you need to express yourself and connect with your community</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: SmilePlus, title: "Reactions & Likes", desc: "Express yourself with diverse reactions - Like, Love, Haha, Wow, Sad, and Angry" },
              { icon: MessagesSquare, title: "Threaded Comments", desc: "Have meaningful conversations with nested replies and community discussions" },
              { icon: UserRoundPlus, title: "Follow & Connect", desc: "Build your network and stay updated with people who inspire you" },
              { icon: Hash, title: "Trending Hashtags", desc: "Discover what's trending globally and join conversations that matter" },
              { icon: Clapperboard, title: "Stories (24h)", desc: "Share ephemeral moments with your followers that disappear in 24 hours" },
              { icon: BellRing, title: "Smart Notifications", desc: "Stay informed with real-time alerts for likes, comments, and follows" },
              { icon: ImagePlus, title: "Media Sharing", desc: "Share photos and videos with your community instantly" },
              { icon: LockKeyhole, title: "Privacy Control", desc: "Choose visibility settings - Public, Followers Only, or Private posts" },
            ].map((feature, idx) => (
              <div key={idx} className="group p-5 sm:p-6 rounded-2xl border border-border bg-white hover:shadow-lg transition-all duration-300">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-3 sm:mb-4 group-hover:from-primary/30 group-hover:to-primary/20 transition-all">
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-base sm:text-lg mb-1.5 sm:mb-2">{feature.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container px-4 sm:px-6 pt-4 pb-12 sm:pt-6 sm:pb-16 md:pt-8 md:pb-24 lg:pt-10 lg:pb-32">
          <div className="text-center space-y-6 sm:space-y-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Ready to Connect?</h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">Join millions of users sharing moments, building connections, and inspiring communities</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link to="/auth/signup"><Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white rounded-full px-8">Create Account</Button></Link>
              <Link to="/feed"><Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full px-8">Browse Public Feed</Button></Link>
            </div>
          </div>
        </section>

        <footer className="border-t bg-white/50 backdrop-blur py-8 sm:py-12">
          <div className="container px-4 sm:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
              <div className="col-span-2 md:col-span-1 space-y-4">
                <div className="flex items-center gap-2 font-bold">
                  <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center"><Orbit className="w-5 h-5 text-white" /></div>
                  <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">ConnectSphere</span>
                </div>
                <p className="text-sm text-muted-foreground">Share Moments. Build Connections. Inspire Communities.</p>
              </div>
              <div className="space-y-3 sm:space-y-4">
                <h4 className="font-semibold text-sm sm:text-base">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-primary transition">Features</a></li>
                  <li><a href="#" className="hover:text-primary transition">Security</a></li>
                  <li><a href="#" className="hover:text-primary transition">Pricing</a></li>
                </ul>
              </div>
              <div className="space-y-3 sm:space-y-4">
                <h4 className="font-semibold text-sm sm:text-base">Company</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-primary transition">About</a></li>
                  <li><a href="#" className="hover:text-primary transition">Blog</a></li>
                  <li><a href="#" className="hover:text-primary transition">Careers</a></li>
                </ul>
              </div>
              <div className="space-y-3 sm:space-y-4">
                <h4 className="font-semibold text-sm sm:text-base">Legal</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-primary transition">Privacy</a></li>
                  <li><a href="#" className="hover:text-primary transition">Terms</a></li>
                  <li><a href="#" className="hover:text-primary transition">Contact</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-6 sm:pt-8 text-center text-xs sm:text-sm text-muted-foreground">
              <p>&copy; 2026 ConnectSphere. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
