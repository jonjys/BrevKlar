import { randomUUID } from 'crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BankIdInitResult {
  orderRef: string;
  autoStartToken: string;
  qrStartToken: string;
}

export interface BankIdCompletion {
  personalNumber: string;
  name: string;
  /** BankID:s unika subject för användaren (motsvarar bankIdSubject). */
  subject: string;
}

export type BankIdCollect =
  | { status: 'pending'; hintCode: string }
  | { status: 'failed'; hintCode: string }
  | { status: 'complete'; completion: BankIdCompletion };

/**
 * Inkapslar BankID-flödet (RP API v6: auth -> collect).
 *
 * I utvecklingsläge (BANKID_MOCK_ENABLED=true) simuleras hela flödet utan
 * certifikat: ett auth-anrop blir direkt "complete" vid nästa collect. Det gör
 * att inloggning kan testas end-to-end lokalt.
 *
 * I produktion ersätts mockarna med mTLS-anrop mot BANKID_API_URL med
 * klientcertifikat (BANKID_CLIENT_CERT_PATH / BANKID_CA_CERT_PATH).
 */
@Injectable()
export class BankIdService {
  private readonly logger = new Logger(BankIdService.name);
  private readonly mockEnabled: boolean;

  // In-memory order-store för mockläget. Produktion håller ingen state här.
  private readonly mockOrders = new Map<string, { personalNumber: string; name: string }>();

  constructor(private readonly config: ConfigService) {
    this.mockEnabled = this.config.get<string>('BANKID_MOCK_ENABLED') === 'true';
    if (this.mockEnabled) {
      this.logger.warn('BankID körs i MOCK-läge – ingen riktig e-legitimation används.');
    }
  }

  async initAuth(endUserIp: string, mockPersonalNumber?: string): Promise<BankIdInitResult> {
    if (this.mockEnabled) {
      const orderRef = randomUUID();
      this.mockOrders.set(orderRef, {
        personalNumber: mockPersonalNumber ?? '199001011234',
        name: 'Test Testsson',
      });
      return {
        orderRef,
        autoStartToken: randomUUID(),
        qrStartToken: randomUUID(),
      };
    }

    // TODO(prod): mTLS POST ${BANKID_API_URL}/auth med { endUserIp }.
    void endUserIp;
    throw new ServiceUnavailableException(
      'Riktig BankID-integration är inte konfigurerad. Sätt BANKID_MOCK_ENABLED=true för utveckling.',
    );
  }

  async collect(orderRef: string): Promise<BankIdCollect> {
    if (this.mockEnabled) {
      const order = this.mockOrders.get(orderRef);
      if (!order) return { status: 'failed', hintCode: 'noOrder' };
      this.mockOrders.delete(orderRef);
      return {
        status: 'complete',
        completion: {
          personalNumber: order.personalNumber,
          name: order.name,
          subject: `mock:${order.personalNumber}`,
        },
      };
    }

    // TODO(prod): mTLS POST ${BANKID_API_URL}/collect med { orderRef }.
    throw new ServiceUnavailableException('Riktig BankID-integration är inte konfigurerad.');
  }
}
