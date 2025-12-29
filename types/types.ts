export type UserPasswordUpdateType = {
  userId: string;
  password: string;
};

export type UserInfoParam = {
  userId: string;
  email: string;
  role?: string | null;
  exp: number;
};
