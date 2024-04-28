import { ThemeToggle } from "@/components/theme-toggle";

const Navbar = () => {
  return (
    <div className="flex w-full justify-between py-2 px-6">
      <div className="flex items-center space-x-2 justify-between w-full">
        <h2 className="text-xl font-semibold mx-2">Editor</h2>
        <ThemeToggle />
      </div>
    </div>
  );
};

export default Navbar;
