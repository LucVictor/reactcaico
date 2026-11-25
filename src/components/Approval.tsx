import { useState } from "react";
import {
  Badge,
  Button,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Textarea,
} from "flowbite-react";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalInfo {
  approval_status?: ApprovalStatus;
  rejection_reason?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
}

const STATUS_META: Record<
  ApprovalStatus,
  { label: string; color: "warning" | "success" | "failure" }
> = {
  pending: { label: "Pendente", color: "warning" },
  approved: { label: "Aprovado", color: "success" },
  rejected: { label: "Reprovado", color: "failure" },
};

export function ApprovalBadge({ status }: { status?: ApprovalStatus }) {
  if (!status) return null;
  const meta = STATUS_META[status];
  return <Badge color={meta.color}>{meta.label}</Badge>;
}

export function RejectionNote({
  item,
  className = "",
}: {
  item: ApprovalInfo;
  className?: string;
}) {
  if (item.approval_status !== "rejected" || !item.rejection_reason) return null;

  return (
    <p
      className={`text-xs text-red-600 dark:text-red-400 ${className}`}
      title={item.rejection_reason}
    >
      <span className="font-semibold">Motivo:</span> {item.rejection_reason}
    </p>
  );
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const detail = (
      err as { response?: { data?: { detail?: string; message?: string } } }
    ).response?.data;
    if (detail?.detail) return String(detail.detail);
    if (detail?.message) return String(detail.message);
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

interface ApprovalActionsProps {
  onApprove: () => Promise<unknown>;
  onReject: (reason: string) => Promise<unknown>;
  size?: "xs" | "sm";
}

export function ApprovalActions({
  onApprove,
  onReject,
  size = "xs",
}: ApprovalActionsProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "approve" | "reject") {
    setPending(action);
    setError(null);
    try {
      if (action === "approve") {
        await onApprove();
      } else {
        await onReject(reason.trim());
      }
      setRejectOpen(false);
      setReason("");
    } catch (err) {
      setError(getErrorMessage(err, "Erro ao registrar a decisão."));
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          size={size}
          color="success"
          disabled={pending !== null}
          onClick={() => run("approve")}
        >
          {pending === "approve" ? <Spinner size="sm" /> : "Aprovar"}
        </Button>
        <Button
          size={size}
          color="failure"
          disabled={pending !== null}
          onClick={() => {
            setError(null);
            setRejectOpen(true);
          }}
        >
          Reprovar
        </Button>
      </div>

      {error && !rejectOpen && (
        <p className="mt-1 max-w-[220px] text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <Modal
        show={rejectOpen}
        onClose={() => {
          if (pending === null) setRejectOpen(false);
        }}
        size="md"
      >
        <ModalHeader>Reprovar cadastro</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <Label htmlFor="motivo-reprovacao">
              Motivo da reprovação (obrigatório)
            </Label>
            <Textarea
              id="motivo-reprovacao"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo da reprovação"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Os pontos concedidos por este cadastro serão estornados.
            </p>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="failure"
            disabled={pending !== null || reason.trim().length === 0}
            onClick={() => run("reject")}
          >
            {pending === "reject" ? <Spinner size="sm" /> : "Reprovar"}
          </Button>
          <Button
            color="gray"
            disabled={pending !== null}
            onClick={() => setRejectOpen(false)}
          >
            Cancelar
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
