import React from "react";
import { MapPin } from "lucide-react";

interface HeaderProps {
  right?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ right }) => {
  return (
    <>
      <header className="glass-nav fixed top-0 left-0 right-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">VoiceUp</h1>
          </div>

          <div className="flex items-center gap-4">{right}</div>
        </div>
      </header>

      {/* spacer to prevent content from being hidden under fixed header */}
      <div className="nav-spacer" aria-hidden />
    </>
  );
};

export default Header;
