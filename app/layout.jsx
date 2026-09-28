import "./globals.css";

export const metadata = {
  title: "Finhaus Lead Dashboard",
  description: "Forminator lead tracking dashboard for Finhaus"
};

export default function RootLayout({ children }) {
  return (
    <html lang="lt">
      <body>{children}</body>
    </html>
  );
}
