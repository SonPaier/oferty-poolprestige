import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, User } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      const success = login(username, password);
      setLoading(false);

      if (success) {
        toast.success('Zalogowano pomyślnie');
        navigate('/', { replace: true });
      } else {
        toast.error('Nieprawidłowy login lub hasło');
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8 space-y-6 bg-card/95 backdrop-blur-sm">
        <div className="text-center space-y-4">
          <div className="bg-slate-800 rounded-lg p-4 inline-block">
            <img 
              src={logo} 
              alt="Pool Prestige" 
              className="h-16 mx-auto object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Konfigurator Basenów</h1>
            <p className="text-muted-foreground text-sm mt-1">Panel administracyjny</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Login</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Wprowadź login"
                className="pl-10 input-field"
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Wprowadź hasło"
                className="pl-10 input-field"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Dostęp tylko dla autoryzowanych użytkowników
        </p>
      </div>
    </div>
  );
}
