import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="app-shell-muted flex items-center justify-center">
        <div className="text-center space-y-6 px-4">
          <div className="flex justify-center"><div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center"><Compass className="w-10 h-10 text-primary" /></div></div>
          <h1 className="text-6xl sm:text-8xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">404</h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-md mx-auto">Oops! This page doesn't exist. Let's get you back on track.</p>
          <div className="flex gap-3 justify-center"><Link to="/"><Button className="bg-gradient-to-r from-primary to-secondary text-white rounded-full px-6">Go Home</Button></Link><Link to="/feed"><Button variant="outline" className="rounded-full px-6">Browse Feed</Button></Link></div>
        </div>
      </main>
    </>
  );
}
