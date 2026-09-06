import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GoogleLogin } from "@react-oauth/google";
import { FlaskConical, GraduationCap } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleGoogleSuccess(response) {
    try {
      await login(response.credential);
      toast.success("Signed in successfully");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error("Login failed", {
        description: err.message || "Unable to sign in with Google.",
      });
    }
  }

  if (isAuthenticated) return null;

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="w-full overflow-hidden rounded-lg border border-gray-100 bg-white shadow-elevated"
    >
      <div className="flex flex-col items-center px-8 pt-8 pb-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary-500 shadow-soft">
          <FlaskConical className="h-7 w-7 text-white" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
          LabFlow
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Laboratory Management System
        </p>
      </div>

      <div className="px-8 pb-8 flex flex-col items-center gap-4">
        <p className="text-sm text-gray-500 text-center">
          Sign in with your KMITL Google account
        </p>

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => toast.error("Google Sign-In failed")}
            theme="outline"
            size="large"
            text="signin_with"
            shape="rectangular"
            width="300"
          />
        </div>

        <div className="flex items-center gap-2 mt-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs">
          <GraduationCap className="h-4 w-4 flex-shrink-0" />
          <span>
            Only <strong>@kmitl.ac.th</strong> emails are allowed
          </span>
        </div>
      </div>
    </motion.div>
  );
}
