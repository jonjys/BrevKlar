import { IsOptional, IsString, Matches } from 'class-validator';

export class StartLoginDto {
  /**
   * Endast i mock-läge: vilket personnummer testanvändaren ska få.
   * Ignoreras helt i produktion (riktig BankID styr identiteten).
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{10,12}$/, { message: 'mockPersonalNumber måste vara 10–12 siffror.' })
  mockPersonalNumber?: string;
}

export class CollectLoginDto {
  @IsString()
  orderRef!: string;
}
