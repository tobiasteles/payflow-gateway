import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, test, vi } from "vitest";
import { CheckoutForm } from "@/components/checkout-form";
import { Dashboard } from "@/components/dashboard";
import { StatusBadge } from "@/components/status-badge";
import { parseBRLToCents } from "@/lib/format";
import type { Charge, TxStatus } from "@/lib/types";

describe("parseBRLToCents", () => {
  test.each([
    ["150,00", 15000],
    ["1.234,56", 123456],
    ["99", 9900],
    ["0,5", 50],
    ["R$ 10,05", 1005],
  ])("%s → %i", (input, cents) => expect(parseBRLToCents(input)).toBe(cents));
  test.each([[""], ["abc"], ["1,234"], ["1,2,3"]])("%j é inválido", (input) =>
    expect(parseBRLToCents(input)).toBeNull(),
  );
});

describe("StatusBadge", () => {
  test.each<[TxStatus, string]>([
    ["approved", "Aprovado"],
    ["processing", "Processando"],
    ["retrying", "Retentando..."],
    ["failed", "Falhou"],
    ["refunded", "Estornado"],
  ])('%s → "%s"', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByRole("status")).toHaveTextContent(label);
  });
});

describe("CheckoutForm", () => {
  it("mostra a prévia de taxas e envia a cobrança", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CheckoutForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/valor/i), "100,00");
    await user.selectOptions(screen.getByLabelText(/bandeira/i), "elo");
    await user.selectOptions(
      screen.getByLabelText(/modalidade/i),
      "credit_installments",
    );
    await user.selectOptions(screen.getByLabelText(/parcelas/i), "12");

    const preview = within(screen.getByLabelText(/prévia de taxas/i));
    expect(preview.getByText(/4,60%/)).toBeInTheDocument(); // Elo 3,10% + 1,50%

    await user.click(screen.getByRole("button", { name: "Cobrar" }));
    expect(onSubmit).toHaveBeenCalledWith({
      amountCents: 10000,
      brand: "elo",
      mode: "credit_installments",
      installments: 12,
    });
  });

  it("bloqueia envio sem valor e mostra o erro", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CheckoutForm onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Cobrar" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/maior que zero/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("esconde parcelas fora do crédito parcelado", () => {
    render(<CheckoutForm onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText(/parcelas/i)).not.toBeInTheDocument();
  });
});

describe("Dashboard", () => {
  const created: Charge = {
    id: "ch_TESTE001",
    amountCents: 15000,
    brand: "visa",
    mode: "debit",
    installments: 1,
    status: "approved",
    mdrCents: 225,
    netCents: 14775,
    payoutDate: "2026-10-13",
    createdAt: "2026-10-12T15:00:00Z",
  };

  it("cria uma cobrança, atualiza o extrato e escreve no terminal", async () => {
    const user = userEvent.setup();
    const createCharge = vi.fn().mockResolvedValue(created);
    render(<Dashboard createCharge={createCharge} initialCharges={[]} />);

    expect(screen.getByText(/Nenhuma cobrança ainda/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/valor/i), "150,00");
    await user.selectOptions(screen.getByLabelText(/modalidade/i), "debit");
    await user.click(screen.getByRole("button", { name: "Cobrar" }));

    expect(createCharge).toHaveBeenCalledWith({
      amountCents: 15000,
      brand: "visa",
      mode: "debit",
      installments: 1,
    });
    expect(await screen.findByText("ch_TESTE001")).toBeInTheDocument();
    expect(
      within(screen.getByRole("log")).getByText(/ch_TESTE001 → approved/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("metric-Saldo acumulado")).toHaveTextContent(
      /147,75/,
    );
  });

  it("mostra erro no terminal quando a API falha", async () => {
    const user = userEvent.setup();
    render(
      <Dashboard
        createCharge={vi.fn().mockRejectedValue(new Error("HTTP 502"))}
        initialCharges={[]}
      />,
    );
    await user.type(screen.getByLabelText(/valor/i), "10");
    await user.click(screen.getByRole("button", { name: "Cobrar" }));
    expect(
      await screen.findByText(/cobrança recusada: HTTP 502/),
    ).toBeInTheDocument();
  });
});
