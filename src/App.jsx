import { Navigate, Route, Routes } from "react-router";
import ChatwootWidget from "./components/support/ChatwootWidget.jsx";
import DashboardLayout from "./layout/DashboardLayout.jsx";
import MarketingLayout from "./layout/MarketingLayout.jsx";
import ForgotPasswordPage from "./pages/auth/forgot-password/ForgotPasswordPage.jsx";
import LoginPage from "./pages/auth/login/LoginPage.jsx";
import RegisterPage from "./pages/auth/register/RegisterPage.jsx";
import DashboardPage from "./pages/dashboard/DashboardPage.jsx";
import DepositPage from "./pages/deposit/DepositPage.jsx";
import FixedDepositPage from "./pages/fixed-deposit/FixedDepositPage.jsx";
import LoansPage from "./pages/loans/LoansPage.jsx";
import ContactPage from "./pages/marketing/contact/ContactPage.jsx";
import HomePage from "./pages/marketing/home/HomePage.jsx";
import LegalPage from "./pages/marketing/legal/LegalPage.jsx";
import NotFoundPage from "./pages/not-found/NotFoundPage.jsx";
import ProfilePage from "./pages/profile/ProfilePage.jsx";
import TransactionHistoryPage from "./pages/transaction-history/TransactionHistoryPage.jsx";
import TransferPage from "./pages/transfer/TransferPage.jsx";
import RequireAuth from "./auth/RequireAuth.jsx";

function App() {
  return (
    <>
      <ChatwootWidget />
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/legal" element={<LegalPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/transactions"
          element={<Navigate replace to="/transaction-history" />}
        />
        <Route
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/deposit" element={<DepositPage />} />
          <Route path="/transfer" element={<TransferPage />} />
          <Route path="/fixed-deposit" element={<FixedDepositPage />} />
          <Route path="/loans" element={<LoansPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route
            path="/transaction-history"
            element={<TransactionHistoryPage />}
          />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export default App;
