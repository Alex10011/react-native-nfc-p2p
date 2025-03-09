export interface User {
  id: string;
  name: string;
  age: number;
  email: string;
  avatar: string;
  lastActive: Date;
}

export function generateRandomUser(): User {
  // Lista de nombres aleatorios
  const names = [
    "Ana",
    "Juan",
    "María",
    "Carlos",
    "Sofía",
    "Miguel",
    "Laura",
    "Fernando",
    "Isabella",
    "Diego",
    "Valentina",
    "Pedro",
  ];

  // Lista de apellidos aleatorios
  const lastNames = [
    "García",
    "Rodríguez",
    "Martínez",
    "López",
    "González",
    "Pérez",
    "Sánchez",
    "Romero",
    "Torres",
    "Ruiz",
    "Díaz",
    "Vargas",
  ];

  // Generar un ID único basado en timestamp
  const id = `usr_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .substring(2, 7)}`;

  // Seleccionar nombre y apellido aleatorios
  const name = `${names[Math.floor(Math.random() * names.length)]} ${
    lastNames[Math.floor(Math.random() * lastNames.length)]
  }`;

  // Generar edad aleatoria entre 18 y 65
  const age = Math.floor(Math.random() * 48) + 18;

  // Crear email basado en el nombre
  const namePart = name.split(" ")[0].toLowerCase();
  const domain = [
    "gmail.com",
    "outlook.com",
    "hotmail.com",
    "yahoo.com",
    "icloud.com",
  ][Math.floor(Math.random() * 5)];
  const email = `${namePart}${Math.floor(Math.random() * 1000)}@${domain}`;

  // URL de avatar aleatorio usando dicebear
  const avatarStyle = ["micah", "avataaars", "bottts", "initials"][
    Math.floor(Math.random() * 4)
  ];
  const avatar = `https://api.dicebear.com/9.x/${avatarStyle}/png?seed=${encodeURIComponent(
    name
  )}`;

  return {
    id,
    name,
    age,
    email,
    avatar,
    lastActive: new Date(),
  };
}

// Singleton para mantener el usuario de la sesión actual
let currentUser: User | null = null;

export function getCurrentUser(): User {
  if (!currentUser) {
    currentUser = generateRandomUser();
  }
  return currentUser;
}

export function resetCurrentUser(): void {
  currentUser = null;
}
