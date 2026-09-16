import { useState } from "react"

import DashboardScreen from "~common/screens/DashboardScreen"
import LoginScreen from "~common/screens/LoginScreen"
import SignupScreen from "~common/screens/SignupScreen"
import { AuthProvider, useAuth } from "~common/state/AuthContext"
import { RoomProvider } from "~common/state/RoomContext"

import "~style.css"

function PopupRouter() {
  const { isAuthed } = useAuth()
  const [authView, setAuthView] = useState<"login" | "signup">("login")

  if (!isAuthed) {
    return authView === "login" ? (
      <LoginScreen onSwitchToSignup={() => setAuthView("signup")} />
    ) : (
      <SignupScreen onSwitchToLogin={() => setAuthView("login")} />
    )
  }

  return <DashboardScreen />
}

function IndexPopup() {
  return (
    <AuthProvider>
      <RoomProvider>
        <div className="h-[600px] w-[400px] overflow-y-auto bg-bg font-sans">
          <PopupRouter />
        </div>
      </RoomProvider>
    </AuthProvider>
  )
}

export default IndexPopup
