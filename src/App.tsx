import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { DataProvider, useData } from '@/lib/data'
import { Layout } from '@/components/Layout'
import { PinLockScreen } from '@/components/PinLock'

import Landing from '@/pages/Landing'
import Login from '@/pages/auth/Login'
import Signup from '@/pages/auth/Signup'
import GoogleOnboarding from '@/pages/auth/GoogleOnboarding'
import RecuperarPassword from '@/pages/auth/RecuperarPassword'
import PrivacyPolicy from '@/pages/legal/PrivacyPolicy'
import Support from '@/pages/legal/Support'
import NosotrosPublic from '@/pages/NosotrosPublic'
import Today from '@/pages/Today'
import Agenda from '@/pages/Agenda'
import Registro from '@/pages/Registro'
import Tratamiento from '@/pages/Tratamiento'
import Carpeta from '@/pages/Carpeta'
import Contactos from '@/pages/Contactos'
import Circulo from '@/pages/Circulo'
import Bienestar from '@/pages/Bienestar'
import Galeria from '@/pages/Galeria'
import Nosotros from '@/pages/Nosotros'
import Privacidad from '@/pages/Privacidad'
import { initNativeStatusBar, registerAndroidBackButton } from '@/lib/native'

function CircleBootstrap({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth()
  const { data, addCircleMember } = useData()

  useEffect(() => {
    if (!currentUser) return
    const already = data.circle.some((m) => m.userId === currentUser.id)
    if (!already) {
      addCircleMember({
        userId: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
        relationship: currentUser.relationship,
        permissions: {
          verAgenda: true,
          recibirRecordatorios: true,
          registrarComoEstuvo: true,
          subirDocumentos: true,
          verMedicacion: true,
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  return <>{children}</>
}

function AppShell() {
  const { currentUser, loading, locked } = useAuth()

  if (loading) return null
  if (!currentUser) return <Navigate to="/" replace />
  if (locked) return <PinLockScreen />

  return (
    <DataProvider>
      <CircleBootstrap>
        <Layout>
          <Routes>
            <Route path="hoy" element={<Today />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="registro" element={<Registro />} />
            <Route path="tratamiento" element={<Tratamiento />} />
            <Route path="carpeta" element={<Carpeta />} />
            <Route path="contactos" element={<Contactos />} />
            <Route path="circulo" element={<Circulo />} />
            <Route path="bienestar" element={<Bienestar />} />
            <Route path="galeria" element={<Galeria />} />
            <Route path="nosotros" element={<Nosotros />} />
            <Route path="privacidad" element={<Privacidad />} />
            <Route path="*" element={<Navigate to="hoy" replace />} />
          </Routes>
        </Layout>
      </CircleBootstrap>
    </DataProvider>
  )
}

export default function App() {
  useEffect(() => {
    initNativeStatusBar()
    registerAndroidBackButton()
  }, [])

  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/ingresar" element={<Login />} />
        <Route path="/crear-cuenta" element={<Signup />} />
        <Route path="/completar-perfil" element={<GoogleOnboarding />} />
        <Route path="/recuperar" element={<RecuperarPassword />} />
        <Route path="/privacidad" element={<PrivacyPolicy />} />
        <Route path="/soporte" element={<Support />} />
        <Route path="/nosotros" element={<NosotrosPublic />} />
        <Route path="/app/*" element={<AppShell />} />
      </Routes>
    </AuthProvider>
  )
}
