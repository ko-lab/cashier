import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import QRCode from "qrcode-svg";
import { client } from "./api/client";
import type {
  AdminGetStockOutput,
  CreditLedgerEntry,
  Member,
  PriceCategory,
  Product,
  Transaction,
  TransactionStatus
} from "@shared/models";
import {
  buildCartSummary,
  sortProducts,
  toTransactionItems,
  updateCartQuantity
} from "./domain/cart";
import {
  filterProductsByQuery,
  formatPriceMode,
  getSelectedItems
} from "./domain/productSection";
import { getUnitPrice } from "./domain/pricing";
import { toStructuredCommunication } from "./domain/structuredCommunication";

type View = "cart" | "checkout" | "topup";
type UiMode = "pos" | "admin";
type AdminTab = "transactions" | "stock" | "members";

type StatusMessage = {
  tone: "error" | "info";
  text: string;
};

type VersionPayload = {
  version?: string;
};

const QR_SIZE = 224;
const VERSION_CHECK_INTERVAL_MS = 60_000;
const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev";

const currencyFormatter =
  typeof Intl !== "undefined" && typeof Intl.NumberFormat === "function"
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "EUR"
      })
    : {
        format(value: number) {
          return `EUR ${value.toFixed(2)}`;
        }
      };

function scrollToTop(): void {
  if (typeof window !== "undefined") {
    window.scrollTo(0, 0);
  }
}

let cashierAudioContext: AudioContext | null = null;

type NavigatorWithAudioSession = Navigator & {
  audioSession?: {
    type?: string;
  };
};

function enableMediaPlaybackAudioMode(): void {
  if (typeof navigator === "undefined") {
    return;
  }

  try {
    const nav = navigator as NavigatorWithAudioSession;
    if (nav.audioSession && typeof nav.audioSession.type === "string") {
      nav.audioSession.type = "playback";
    }
  } catch {
    // Best-effort only; unsupported browsers should continue normally.
  }
}

function getCashierAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextCtor = (
    window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  ) as typeof AudioContext | undefined;

  if (!AudioContextCtor) {
    return null;
  }

  if (!cashierAudioContext) {
    cashierAudioContext = new AudioContextCtor();
  }

  return cashierAudioContext;
}

function playCashierOpenSound(isDarkMode = false): void {
  enableMediaPlaybackAudioMode();
  const context = getCashierAudioContext();
  if (!context) {
    return;
  }

  try {
    if (context.state === "suspended") {
      void context.resume();
    }

    const now = context.currentTime;

    const playTone = (
      frequency: number,
      startAt: number,
      duration: number,
      gain: number,
      type: OscillatorType = "square"
    ) => {
      const oscillator = context.createOscillator();
      const volume = context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startAt);
      oscillator.connect(volume);
      volume.connect(context.destination);

      volume.gain.setValueAtTime(0.0001, startAt);
      volume.gain.exponentialRampToValueAtTime(gain, startAt + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.02);
    };

    // Retro "register opening" arpeggio. Dark mode: deeper + softer.
    const gainBoost = isDarkMode ? 0.85 : 1;
    playTone(isDarkMode ? 196 : 220, now, 0.2, 0.16 * gainBoost, isDarkMode ? "triangle" : "square");
    playTone(isDarkMode ? 294 : 330, now + 0.14, 0.22, 0.17 * gainBoost, isDarkMode ? "triangle" : "square");
    playTone(isDarkMode ? 440 : 494, now + 0.3, 0.26, 0.18 * gainBoost, isDarkMode ? "triangle" : "square");
    playTone(isDarkMode ? 587 : 659, now + 0.46, 0.32, 0.2 * gainBoost, isDarkMode ? "triangle" : "square");
  } catch {
    // Ignore audio errors and continue checkout flow.
  }
}

function playCashierCloseSound(isDarkMode = false): void {
  enableMediaPlaybackAudioMode();
  const context = getCashierAudioContext();
  if (!context) {
    return;
  }

  try {
    if (context.state === "suspended") {
      void context.resume();
    }

    const now = context.currentTime;

    const playTone = (
      frequency: number,
      startAt: number,
      duration: number,
      gain: number,
      type: OscillatorType = "square"
    ) => {
      const oscillator = context.createOscillator();
      const volume = context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startAt);
      oscillator.connect(volume);
      volume.connect(context.destination);

      volume.gain.setValueAtTime(0.0001, startAt);
      volume.gain.exponentialRampToValueAtTime(gain, startAt + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.02);
    };

    // Retro "register closing" descending tones. Dark mode: deeper + softer.
    const gainBoost = isDarkMode ? 0.85 : 1;
    playTone(isDarkMode ? 740 : 880, now, 0.16, 0.16 * gainBoost, isDarkMode ? "triangle" : "square");
    playTone(isDarkMode ? 523 : 622, now + 0.12, 0.2, 0.17 * gainBoost, isDarkMode ? "triangle" : "square");
    playTone(isDarkMode ? 370 : 440, now + 0.28, 0.24, 0.18 * gainBoost, isDarkMode ? "triangle" : "square");
    playTone(isDarkMode ? 262 : 311, now + 0.48, 0.3, 0.2 * gainBoost, isDarkMode ? "triangle" : "sawtooth");
  } catch {
    // Ignore audio errors and continue checkout flow.
  }
}

function playTypewriterAddSound(isDarkMode = false): void {
  enableMediaPlaybackAudioMode();
  const context = getCashierAudioContext();
  if (!context) {
    return;
  }

  try {
    if (context.state === "suspended") {
      void context.resume();
    }

    const now = context.currentTime;

    const playClick = (startAt: number, frequency: number) => {
      const oscillator = context.createOscillator();
      const volume = context.createGain();

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(frequency, startAt);
      oscillator.connect(volume);
      volume.connect(context.destination);

      volume.gain.setValueAtTime(0.0001, startAt);
      volume.gain.exponentialRampToValueAtTime(isDarkMode ? 0.065 : 0.08, startAt + 0.003);
      volume.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.03);

      oscillator.start(startAt);
      oscillator.stop(startAt + 0.035);
    };

    // 5 key taps
    const pitchShift = isDarkMode ? 0.88 : 1;
    playClick(now + 0.0, 1750 * pitchShift);
    playClick(now + 0.045, 1600 * pitchShift);
    playClick(now + 0.09, 1820 * pitchShift);
    playClick(now + 0.135, 1680 * pitchShift);
    playClick(now + 0.18, 1780 * pitchShift);

    // carriage-return / linefeed bell-ish ding
    const ding = context.createOscillator();
    const dingGain = context.createGain();
    const dingStart = now + 0.24;
    ding.type = isDarkMode ? "sine" : "triangle";
    ding.frequency.setValueAtTime((isDarkMode ? 1160 : 1320), dingStart);
    ding.frequency.exponentialRampToValueAtTime((isDarkMode ? 860 : 980), dingStart + 0.18);
    ding.connect(dingGain);
    dingGain.connect(context.destination);
    dingGain.gain.setValueAtTime(0.0001, dingStart);
    dingGain.gain.exponentialRampToValueAtTime(isDarkMode ? 0.08 : 0.1, dingStart + 0.01);
    dingGain.gain.exponentialRampToValueAtTime(0.0001, dingStart + 0.2);
    ding.start(dingStart);
    ding.stop(dingStart + 0.22);
  } catch {
    // Ignore audio errors.
  }
}

function readStoredTheme(): boolean {
  try {
    const stored = localStorage.getItem("theme");
    return stored ? stored === "dark" : false;
  } catch {
    return false;
  }
}

function persistTheme(isDark: boolean): void {
  try {
    localStorage.setItem("theme", isDark ? "dark" : "light");
  } catch {
    // Ignore storage failures (e.g., old/private Safari)
  }
}

function readMemberCreditFeatureFlag(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("featureMemberCredit") === "on";
  } catch {
    return false;
  }
}

function persistMemberCreditFeatureFlag(enabled: boolean): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("featureMemberCredit", enabled ? "on" : "off");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Ignore history failures
  }
}

function csvEscape(value: string | number | boolean): string {
  const text = String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function formatAdminDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function transactionDisplayItems(transaction: Transaction): Transaction["items"] {
  if (transaction.type === "credit_topup") {
    return [
      {
        productId: "__member_credit__",
        name: "Member credit top-up",
        quantity: 1,
        unitPrice: transaction.total,
        lineTotal: transaction.total,
        isMemberPrice: true
      }
    ];
  }
  return transaction.items;
}

function buildCartBreakdownJson(transaction: Transaction): string {
  return JSON.stringify(
    transactionDisplayItems(transaction).map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      isMemberPrice: item.isMemberPrice,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      ...(transaction.type === "credit_topup" && transaction.memberId
        ? { customerId: transaction.memberId }
        : {})
    }))
  );
}

function buildTransactionsCsv(transactions: Transaction[]): string {
  const header = [
    "id",
    "createdAt",
    "type",
    "status",
    "total",
    "itemCount",
    "items"
  ];
  const lines = transactions.map((transaction) => {
    const itemsSummary = buildCartBreakdownJson(transaction);
    return [
      transaction.id,
      transaction.createdAt,
      transaction.type,
      transaction.status,
      transaction.total.toFixed(2),
      transactionDisplayItems(transaction).length,
      itemsSummary
    ]
      .map(csvEscape)
      .join(",");
  });
  return [header.join(","), ...lines].join("\n");
}

function buildStockEventsCsv(
  events: AdminGetStockOutput["events"],
  productNameById: Map<string, string>
): string {
  const header = ["id", "createdAt", "productId", "productName", "type", "quantity", "note"];
  const lines = events.map((event) =>
    [
      event.id,
      event.createdAt,
      event.productId,
      productNameById.get(event.productId) ?? "",
      event.type,
      event.quantity,
      event.note ?? ""
    ]
      .map(csvEscape)
      .join(",")
  );

  return [header.join(","), ...lines].join("\n");
}

function buildStockCountsCsv(items: AdminGetStockOutput["items"]): string {
  const header = ["productId", "productName", "currentQuantity", "updatedAt"];
  const lines = items.map((item) =>
    [item.productId, item.productName, item.quantity, item.updatedAt ?? ""]
      .map(csvEscape)
      .join(",")
  );

  return [header.join(","), ...lines].join("\n");
}

function readInitialUiMode(): UiMode {
  if (typeof window === "undefined") {
    return "pos";
  }

  const value = new URLSearchParams(window.location.search).get("mode");
  return value === "admin" ? "admin" : "pos";
}

function readInitialAdminTab(): AdminTab {
  if (typeof window === "undefined") {
    return "transactions";
  }

  const value = new URLSearchParams(window.location.search).get("tab");
  if (value === "stock" || value === "members") {
    return value;
  }
  return "transactions";
}

function readInitialView(): View {
  if (typeof window === "undefined") {
    return "cart";
  }

  const value = new URLSearchParams(window.location.search).get("screen");
  return value === "topup" ? "topup" : "cart";
}

function readAdminUnlockUsername(): string {
  if (typeof window === "undefined") {
    return "cashier_admin";
  }

  return `${window.location.origin}_admin`;
}

export default function App() {
  const [uiMode, setUiMode] = useState<UiMode>(readInitialUiMode);
  const [products, setProducts] = useState<Product[]>([]);
  const [priceCategories, setPriceCategories] = useState<PriceCategory[]>([]);
  const [cart, setCart] = useState<
    { productId: string; quantity: number; isMemberPrice: boolean }[]
  >([]);
  const [defaultIsMemberPrice, setDefaultIsMemberPrice] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<View>(readInitialView);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [qrImageSrc, setQrImageSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminTransactions, setAdminTransactions] = useState<Transaction[] | null>(
    null
  );
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminStatusFilter, setAdminStatusFilter] = useState<
    "all" | TransactionStatus
  >("all");
  const [adminProductFilter, setAdminProductFilter] = useState("all");
  const [adminItemQuery, setAdminItemQuery] = useState("");
  const [adminFromDate, setAdminFromDate] = useState("");
  const [adminToDate, setAdminToDate] = useState("");
  const [adminTab, setAdminTab] = useState<AdminTab>(readInitialAdminTab);
  const [adminSessionPassword, setAdminSessionPassword] = useState("");
  const [stockSnapshot, setStockSnapshot] = useState<AdminGetStockOutput | null>(null);
  const [stockDraftByProductId, setStockDraftByProductId] = useState<Record<string, string>>({});
  const [stockNoteByProductId, setStockNoteByProductId] = useState<Record<string, string>>({});
  const [stockProductQuery, setStockProductQuery] = useState("");
  const [stockCurrentValueFilter, setStockCurrentValueFilter] = useState("");
  const [isDark, setIsDark] = useState(readStoredTheme);
  const [updateReady, setUpdateReady] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [memberCreditEnabled, setMemberCreditEnabled] = useState(readMemberCreditFeatureFlag);
  const [activeMember, setActiveMember] = useState<Member | null>(null);
  const [creditToUse, setCreditToUse] = useState("0.00");
  const [memberPinInput, setMemberPinInput] = useState("");
  const [payWithCreditModalError, setPayWithCreditModalError] = useState<string | null>(null);
  const [showPayWithCreditModal, setShowPayWithCreditModal] = useState(false);
  const [paymentMemberQuery, setPaymentMemberQuery] = useState("");
  const [selectedPaymentMemberId, setSelectedPaymentMemberId] = useState("");
  const [publicCustomers, setPublicCustomers] = useState<Member[]>([]);
  const [memberPricingCustomerId, setMemberPricingCustomerId] = useState("");
  const [memberPricingAuthMode, setMemberPricingAuthMode] = useState<
    "none" | "pin" | "username_only"
  >("none");
  const [topupMemberQuery, setTopupMemberQuery] = useState("");
  const [selectedTopupMemberId, setSelectedTopupMemberId] = useState("");
  const [topupAmount, setTopupAmount] = useState("10.00");
  const [adminCustomers, setAdminCustomers] = useState<Member[]>([]);
  const [adminMemberName, setAdminMemberName] = useState("");
  const [adminCustomerType, setAdminCustomerType] = useState<"member" | "non_member">("member");
  const [adminMemberPin, setAdminMemberPin] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [memberTopupAmount, setMemberTopupAmount] = useState("");
  const [memberTopupNote, setMemberTopupNote] = useState("");
  const [creditLedger, setCreditLedger] = useState<CreditLedgerEntry[]>([]);
  const [adminCreditEvents, setAdminCreditEvents] = useState<CreditLedgerEntry[]>([]);
  const [adminUnlockUsername] = useState(readAdminUnlockUsername);
  const unloadCanceledTransactionIdRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    persistTheme(isDark);
  }, [isDark]);

  useEffect(() => {
    persistMemberCreditFeatureFlag(memberCreditEnabled);

    if (!memberCreditEnabled) {
      setActiveMember(null);
      setCreditToUse("0.00");
      setMemberPinInput("");
      setShowPayWithCreditModal(false);
      setPublicCustomers([]);
      setSelectedTopupMemberId("");
      setSelectedPaymentMemberId("");
      if (view === "topup") {
        setView("cart");
      }
      if (adminTab === "members") {
        setAdminTab("transactions");
      }
    }
  }, [adminTab, memberCreditEnabled, view]);

  useEffect(() => {
    if (!memberCreditEnabled || (view !== "topup" && view !== "checkout")) {
      return;
    }

    let mounted = true;
    void client.member
      .list()
      .then((response) => {
        if (!mounted) return;
        setPublicCustomers(response.members);
      })
      .catch(() => {
        if (!mounted) return;
        setPublicCustomers([]);
      });

    return () => {
      mounted = false;
    };
  }, [memberCreditEnabled, view]);

  useEffect(() => {
    if (!showPayWithCreditModal) {
      setPaymentMemberQuery("");
      setSelectedPaymentMemberId("");
      setMemberPinInput("");
      setPayWithCreditModalError(null);
    }
  }, [showPayWithCreditModal]);

  useEffect(() => {
    if (view !== "checkout" || !transaction) {
      setMemberPricingCustomerId("");
      setMemberPricingAuthMode("none");
      return;
    }

    setMemberPricingCustomerId(transaction.memberId ?? "");
    setMemberPricingAuthMode(transaction.memberId ? "pin" : "none");
  }, [transaction, view]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.delete("mode");
    params.delete("tab");
    params.delete("screen");

    if (uiMode === "admin") {
      params.set("mode", "admin");
      if (adminTab !== "transactions") {
        params.set("tab", adminTab);
      }
    } else if (view === "topup") {
      params.set("screen", "topup");
    }

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [adminTab, uiMode, view]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    client.product
      .list()
      .then((data) => {
        if (isMounted) {
          setProducts(sortProducts(Object.values(data.products)));
          setPriceCategories(Object.values(data.priceCategories));
          setStatus(null);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          const message =
            error instanceof Error ? error.message : String(error);
          setStatus({
            tone: "error",
            text: `Failed to load products: ${message}`
          });
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(
    () => buildCartSummary(products, priceCategories, cart),
    [products, priceCategories, cart]
  );

  const filteredProducts = useMemo(
    () => filterProductsByQuery(products, searchQuery),
    [products, searchQuery]
  );

  const cartItemsForCheckout = useMemo(
    () => getSelectedItems(products, priceCategories, cart, ""),
    [products, priceCategories, cart]
  );

  const structuredCommunication = useMemo(
    () => (transaction ? toStructuredCommunication(transaction.id) : null),
    [transaction]
  );
  const paymentIbanName = import.meta.env.VITE_IBAN_NAME ?? "KO-LAB";
  const paymentIbanNumber = import.meta.env.VITE_IBAN ?? "BE00000000000000";

  useEffect(() => {
    if (!transaction || !structuredCommunication) {
      setQrImageSrc(null);
      return;
    }

    const payMessage = structuredCommunication;
    const amount = transaction.total.toFixed(2);
    const payload = [
      "BCD",
      "002",
      "1",
      "SCT",
      "",
      `${paymentIbanName}`,
      `${paymentIbanNumber}`,
      `EUR${amount}`,
      "",
      "",
      payMessage.substring(0, 100),
      ""
    ].join("\n");

    const qr = new QRCode({
      content: payload,
      padding: 4,
      width: QR_SIZE,
      height: QR_SIZE,
      color: "#000000",
      background: "#ffffff",
      ecl: "H"
    });

    const qrSvg = qr.svg();
    setQrImageSrc(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`
    );
  }, [paymentIbanName, paymentIbanNumber, structuredCommunication, transaction]);

  useEffect(() => {
    if (uiMode !== "pos" || view !== "checkout" || !transaction) {
      return;
    }

    const cancelPendingTransactionOnLeave = () => {
      if (unloadCanceledTransactionIdRef.current === transaction.id) {
        return;
      }

      unloadCanceledTransactionIdRef.current = transaction.id;
      void client.transaction
        .finalize({
          id: transaction.id,
          status: "abandoned",
          reason: "tab_closure"
        })
        .catch(() => {
          // Best-effort cancellation during page unload.
        });
    };

    window.addEventListener("pagehide", cancelPendingTransactionOnLeave);
    window.addEventListener("beforeunload", cancelPendingTransactionOnLeave);

    return () => {
      window.removeEventListener("pagehide", cancelPendingTransactionOnLeave);
      window.removeEventListener("beforeunload", cancelPendingTransactionOnLeave);
    };
  }, [transaction, uiMode, view]);

  const handleQuantityChange = (
    productId: string,
    delta: number,
    isMemberPrice: boolean
  ) => {
    if (delta > 0) {
      playTypewriterAddSound(isDark);
    }

    setCart((current) =>
      updateCartQuantity(current, productId, delta, isMemberPrice)
    );
  };

  const openCheckoutConfirm = () => {
    if (!hasCheckoutItems || isBusy) {
      return;
    }
    setShowCheckoutConfirm(true);
  };

  const selectCheckoutMember = (member: Member | null) => {
    setActiveMember(member);
    if (!member) {
      setCreditToUse("0.00");
      return;
    }

    const maxCredit = Math.min(payableTotal, member.balance);
    setCreditToUse(maxCredit.toFixed(2));
  };

  const authenticateMemberPin = async () => {
    const pin = memberPinInput.trim();
    if (!pin) {
      if (showPayWithCreditModal) {
        setPayWithCreditModalError("Enter customer PIN.");
      } else {
        setStatus({ tone: "error", text: "Enter customer PIN." });
      }
      return;
    }

    try {
      const response = await client.member.authPin({ pin });

      if (showPayWithCreditModal && selectedPaymentMemberId && response.member.id !== selectedPaymentMemberId) {
        setPayWithCreditModalError("PIN does not match selected customer.");
        return;
      }

      if (!showPayWithCreditModal && isTopupView && selectedTopupMemberId && response.member.id !== selectedTopupMemberId) {
        setStatus({ tone: "error", text: "PIN does not match selected customer." });
        return;
      }

      if (
        !showPayWithCreditModal &&
        view === "checkout" &&
        memberPricingCustomerId &&
        response.member.id !== memberPricingCustomerId
      ) {
        setStatus({ tone: "error", text: "PIN does not match selected customer." });
        return;
      }

      setPayWithCreditModalError(null);
      selectCheckoutMember(response.member);
      if (view === "checkout" && hasMemberPricedItemsInCheckout) {
        setMemberPricingCustomerId(response.member.id);
        setMemberPricingAuthMode("pin");
      }
      setMemberPinInput("");
      setStatus({ tone: "info", text: `Customer loaded: ${response.member.displayName}` });
    } catch {
      if (showPayWithCreditModal) {
        setPayWithCreditModalError("Invalid customer PIN.");
      } else {
        setStatus({ tone: "error", text: "Invalid customer PIN." });
      }
    }
  };

  const startCheckout = async () => {
    setStatus(null);
    setLoading(true);

    try {
      const response = await client.transaction.start({
        items: toTransactionItems(cart)
      });
      setShowCheckoutConfirm(false);
      setTransaction(response);
      setView("checkout");
      scrollToTop();
    } catch {
      setStatus({ tone: "error", text: "Could not start transaction." });
    } finally {
      setLoading(false);
    }
  };

  const startTopup = async () => {
    if (!selectedTopupMember) {
      setStatus({ tone: "error", text: "Select a customer first." });
      return;
    }

    // PIN is not required to start external top-up payment.

    const amount = Number.parseFloat(topupAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus({ tone: "error", text: "Top-up amount must be greater than zero." });
      return;
    }

    setStatus(null);
    setLoading(true);
    try {
      const response = await client.transaction.startTopup({
        memberId: selectedTopupMember.id,
        amount
      });
      setTransaction(response);
      setView("topup");
      scrollToTop();
    } catch {
      setStatus({ tone: "error", text: "Could not start top-up." });
    } finally {
      setLoading(false);
    }
  };

  const acceptMemberPricingWithUsernameOnly = () => {
    if (!memberPricingCustomerId) {
      setStatus({ tone: "error", text: "Select a customer username first." });
      return;
    }

    setMemberPricingAuthMode("username_only");
    setStatus({ tone: "info", text: "Customer username accepted without PIN for this checkout." });
  };

  const payTransactionWithMemberCredit = async () => {
    if (!transaction) {
      return;
    }

    if (!selectedPaymentMember) {
      setPayWithCreditModalError("Select a customer first.");
      return;
    }

    if (!activeMember || activeMember.id !== selectedPaymentMember.id) {
      setPayWithCreditModalError("Enter valid PIN for selected customer first.");
      return;
    }

    if (activeMember.balance < transaction.total) {
      const shortfall = transaction.total - activeMember.balance;
      setPayWithCreditModalError(
        `Not enough credit. Missing ${currencyFormatter.format(shortfall)}.`
      );
      return;
    }

    setLoading(true);
    try {
      await client.transaction.finalize({
        id: transaction.id,
        status: "completed",
        memberId: activeMember.id,
        creditUsed: transaction.total
      });

      setShowPayWithCreditModal(false);
      setPayWithCreditModalError(null);
      setTransaction(null);
      setView("cart");
      setActiveMember(null);
      setCreditToUse("0.00");
      if (transaction.type === "sale") {
        setCart([]);
      }
      setStatus({ tone: "info", text: "Paid with customer credit." });
      scrollToTop();
    } catch {
      setPayWithCreditModalError("Could not complete customer-credit payment.");
    } finally {
      setLoading(false);
    }
  };

  const finalize = async (status: "completed" | "canceled" | "abandoned") => {
    if (!transaction) {
      return;
    }

    setLoading(true);
    try {
      const isTopup = transaction.type === "credit_topup";
      await client.transaction.finalize({
        id: transaction.id,
        status,
        memberId: activeMember?.id,
        creditUsed: isTopup ? 0 : cartCreditPreview
      });
      if (status === "completed") {
        if (!isTopup) {
          setCart([]);
        }
        setActiveMember(null);
        setCreditToUse("0.00");
      }
      setTransaction(null);
      setView("cart");
      if (status === "completed") {
        scrollToTop();
      }
      setStatus({
        tone: "info",
        text:
          status === "completed"
            ? isTopup
              ? "Top-up completed!"
              : "Thanks for paying!"
            : "Transaction cancelled."
      });
    } catch {
      setStatus({ tone: "error", text: "Could not update transaction." });
    } finally {
      setLoading(false);
    }
  };

  const totalLabel = currencyFormatter.format(summary.total);
  const selectedAdminMember = useMemo(
    () => adminCustomers.find((member) => member.id === selectedMemberId) ?? null,
    [adminCustomers, selectedMemberId]
  );
  const filteredPublicCustomers = useMemo(() => {
    const q = topupMemberQuery.trim().toLowerCase();
    if (!q) {
      return publicCustomers;
    }

    return publicCustomers.filter((member) =>
      member.displayName.toLowerCase().includes(q)
    );
  }, [publicCustomers, topupMemberQuery]);
  const selectedTopupMember = useMemo(
    () => publicCustomers.find((member) => member.id === selectedTopupMemberId) ?? null,
    [publicCustomers, selectedTopupMemberId]
  );
  const filteredPaymentCustomers = useMemo(() => {
    const q = paymentMemberQuery.trim().toLowerCase();
    if (!q) {
      return publicCustomers;
    }
    return publicCustomers.filter((member) =>
      member.displayName.toLowerCase().includes(q)
    );
  }, [paymentMemberQuery, publicCustomers]);
  const selectedPaymentMember = useMemo(
    () => publicCustomers.find((member) => member.id === selectedPaymentMemberId) ?? null,
    [publicCustomers, selectedPaymentMemberId]
  );
  const creditToUseNumber = Number.parseFloat(creditToUse);
  const normalizedCreditToUse = Number.isFinite(creditToUseNumber)
    ? Math.max(0, creditToUseNumber)
    : 0;
  const isTopupView = view === "topup";
  const checkoutCreditUsed = transaction?.creditUsed ?? 0;
  const checkoutExternalAmount = transaction?.externalAmount ?? transaction?.total ?? 0;
  const payableTotal = (view === "checkout" || view === "topup") && transaction ? transaction.total : summary.total;
  const hasMemberPricedItemsInCheckout =
    view === "checkout" &&
    !!transaction &&
    transaction.type === "sale" &&
    transaction.items.some((item) => item.isMemberPrice);
  const memberPricingVerified =
    !hasMemberPricedItemsInCheckout ||
    (memberPricingCustomerId.length > 0 && memberPricingAuthMode !== "none");
  const paymentBlockedByMemberAuth = hasMemberPricedItemsInCheckout && !memberPricingVerified;
  const cartCreditPreview = activeMember
    ? Math.min(activeMember.balance, payableTotal, normalizedCreditToUse)
    : 0;
  const cartExternalDuePreview = Number((payableTotal - cartCreditPreview).toFixed(2));

  const adminFilteredTransactions = useMemo(() => {
    if (!adminTransactions) {
      return [];
    }

    return adminTransactions.filter((transaction) => {
      if (
        adminStatusFilter !== "all" &&
        transaction.status !== adminStatusFilter
      ) {
        return false;
      }
      if (
        adminProductFilter !== "all" &&
        !transaction.items.some((item) => item.productId === adminProductFilter)
      ) {
        return false;
      }
      if (adminItemQuery.trim()) {
        const query = adminItemQuery.trim().toLowerCase();
        const hasMatch = transaction.items.some((item) =>
          `${item.name} ${item.productId}`.toLowerCase().includes(query)
        );
        if (!hasMatch) {
          return false;
        }
      }

      const date = new Date(transaction.createdAt);
      if (!Number.isFinite(date.getTime())) {
        return false;
      }

      if (adminFromDate) {
        const fromDate = new Date(`${adminFromDate}T00:00:00.000Z`);
        if (date < fromDate) {
          return false;
        }
      }

      if (adminToDate) {
        const toDate = new Date(`${adminToDate}T23:59:59.999Z`);
        if (date > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [
    adminTransactions,
    adminStatusFilter,
    adminProductFilter,
    adminItemQuery,
    adminFromDate,
    adminToDate
  ]);

  const adminProductOptions = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const transaction of adminTransactions ?? []) {
      for (const item of transaction.items) {
        if (!lookup.has(item.productId)) {
          lookup.set(item.productId, item.name);
        }
      }
    }
    return [...lookup.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [adminTransactions]);

  const adminTotals = useMemo(() => {
    return adminFilteredTransactions.reduce(
      (accumulator, transaction) => {
        accumulator.count += 1;
        accumulator.amount += transaction.total;
        accumulator[transaction.status] += 1;
        return accumulator;
      },
      { count: 0, amount: 0, pending: 0, completed: 0, canceled: 0, abandoned: 0 }
    );
  }, [adminFilteredTransactions]);

  const hasActiveFilters =
    adminStatusFilter !== "all" ||
    adminProductFilter !== "all" ||
    adminFromDate.length > 0 ||
    adminToDate.length > 0;

  const filteredStockItems = useMemo(() => {
    if (!stockSnapshot) {
      return [];
    }

    const productQuery = stockProductQuery.trim().toLowerCase();
    const currentFilterRaw = stockCurrentValueFilter.trim();
    const hasCurrentFilter = currentFilterRaw.length > 0;
    const currentFilter = Number(currentFilterRaw);

    return stockSnapshot.items.filter((item) => {
      if (productQuery) {
        const haystack = `${item.productName} ${item.productId}`.toLowerCase();
        if (!haystack.includes(productQuery)) {
          return false;
        }
      }

      if (hasCurrentFilter) {
        if (!Number.isFinite(currentFilter) || item.quantity !== currentFilter) {
          return false;
        }
      }

      return true;
    });
  }, [stockCurrentValueFilter, stockProductQuery, stockSnapshot]);

  const filteredStockEvents = useMemo(() => {
    if (!stockSnapshot) {
      return [];
    }

    const allowedProductIds = new Set(filteredStockItems.map((item) => item.productId));
    return stockSnapshot.events.filter((event) => allowedProductIds.has(event.productId));
  }, [filteredStockItems, stockSnapshot]);

  const isBusy = loading || adminLoading;
  const hasCheckoutItems = cart.some((item) => item.quantity > 0);
  const isSafeToRefresh =
    uiMode === "pos" && view === "cart" && !hasCheckoutItems && !isBusy && !transaction;

  useEffect(() => {
    let isMounted = true;

    const checkVersion = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store"
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as VersionPayload;
        const remoteVersion = payload.version?.trim();
        if (!remoteVersion || remoteVersion === APP_VERSION) {
          return;
        }

        if (!isMounted) {
          return;
        }

        if (isSafeToRefresh) {
          window.location.reload();
          return;
        }

        setUpdateReady(true);
      } catch {
        // Ignore failed version checks (offline, transient errors).
      }
    };

    void checkVersion();
    const intervalId = window.setInterval(() => {
      void checkVersion();
    }, VERSION_CHECK_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isSafeToRefresh]);

  useEffect(() => {
    if (updateReady && isSafeToRefresh) {
      window.location.reload();
    }
  }, [updateReady, isSafeToRefresh]);

  const getQuantity = (productId: string, isMemberPrice: boolean) =>
    cart.find(
      (item) =>
        item.productId === productId && item.isMemberPrice === isMemberPrice
    )?.quantity ?? 0;

  const moveStockInputFocus = (
    event: KeyboardEvent<HTMLInputElement>,
    direction: 1 | -1
  ) => {
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>("input[data-stock-input='true']")
    );
    const currentIndex = inputs.findIndex((input) => input === event.currentTarget);
    if (currentIndex < 0) {
      return;
    }

    const target = inputs[currentIndex + direction];
    if (target) {
      event.preventDefault();
      target.focus();
      target.select();
    }
  };

  const loadStockSnapshot = async (password: string) => {
    const response = await client.admin.getStock({ password });
    setStockSnapshot(response);
    setStockDraftByProductId(
      Object.fromEntries(response.items.map((item) => [item.productId, ""]))
    );
  };

  const loadAdminTransactions = async () => {
    setAdminError(null);
    setAdminLoading(true);
    try {
      const password = adminPassword;
      const response = await client.admin.exportTransactions({ password });
      setAdminTransactions(response.transactions);
      await loadStockSnapshot(password);
      if (memberCreditEnabled) {
        await loadAdminCustomers(password);
      }
      setAdminSessionPassword(password);
      setAdminPassword("");
      setAdminStatusFilter("all");
      setAdminProductFilter("all");
      setStockProductQuery("");
      setStockCurrentValueFilter("");
      setAdminFromDate("");
      setAdminToDate("");
    } catch {
      setAdminError("Invalid password or admin panel unavailable.");
    } finally {
      setAdminLoading(false);
    }
  };

  const loadAdminCustomers = async (password: string, preferredMemberId?: string) => {
    const response = await client.admin.listCustomers({ password });
    setAdminCustomers(response.members);

    const nextSelected =
      preferredMemberId && response.members.some((member) => member.id === preferredMemberId)
        ? preferredMemberId
        : response.members[0]?.id ?? "";
    setSelectedMemberId(nextSelected);

    const globalLedgerResponse = await client.admin.creditLedger({ password });
    setAdminCreditEvents(globalLedgerResponse.entries);

    if (nextSelected) {
      const ledgerResponse = await client.admin.creditLedger({
        password,
        memberId: nextSelected
      });
      setCreditLedger(ledgerResponse.entries);
    } else {
      setCreditLedger([]);
    }
  };

  const createAdminMember = async () => {
    if (!adminSessionPassword) {
      setAdminError("Admin session expired. Please unlock again.");
      return;
    }

    const name = adminMemberName.trim();
    const pin = adminMemberPin.trim();
    if (!name || !pin) {
      setAdminError("Member name and PIN are required.");
      return;
    }

    setAdminLoading(true);
    setAdminError(null);
    try {
      const response = await client.admin.createMember({
        password: adminSessionPassword,
        displayName: name,
        customerType: adminCustomerType,
        pin
      });
      setAdminCustomers(response.members);
      const created = response.members.find((member) => member.displayName === name);
      const nextSelected = created?.id ?? response.members[response.members.length - 1]?.id;
      setSelectedMemberId(nextSelected ?? "");
      setAdminMemberName("");
      setAdminCustomerType("member");
      setAdminMemberPin("");
      await loadAdminCustomers(adminSessionPassword, nextSelected);
    } catch {
      setAdminError("Could not create member.");
    } finally {
      setAdminLoading(false);
    }
  };

  const topupSelectedMember = async () => {
    if (!adminSessionPassword || !selectedMemberId) {
      setAdminError("Select a customer first.");
      return;
    }

    const amount = Number.parseFloat(memberTopupAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setAdminError("Top-up amount must be greater than zero.");
      return;
    }

    setAdminLoading(true);
    setAdminError(null);
    try {
      await client.admin.topupCredit({
        password: adminSessionPassword,
        memberId: selectedMemberId,
        amount,
        note: memberTopupNote.trim() || undefined
      });
      setMemberTopupAmount("");
      setMemberTopupNote("");
      await loadAdminCustomers(adminSessionPassword, selectedMemberId);
    } catch {
      setAdminError("Could not top up credit.");
    } finally {
      setAdminLoading(false);
    }
  };

  const toggleSelectedMemberActive = async () => {
    if (!adminSessionPassword || !selectedMemberId) {
      return;
    }

    const target = adminCustomers.find((member) => member.id === selectedMemberId);
    if (!target) {
      return;
    }

    setAdminLoading(true);
    setAdminError(null);
    try {
      await client.admin.setMemberActive({
        password: adminSessionPassword,
        memberId: selectedMemberId,
        active: !target.active
      });
      await loadAdminCustomers(adminSessionPassword, selectedMemberId);
    } catch {
      setAdminError("Could not update member status.");
    } finally {
      setAdminLoading(false);
    }
  };

  const updateStock = async (productId: string) => {
    if (!adminSessionPassword) {
      setAdminError("Admin session expired. Please unlock again.");
      return;
    }

    const draftValue = (stockDraftByProductId[productId] ?? "").trim();
    const note = stockNoteByProductId[productId]?.trim() ?? "";
    const hasNote = note.length > 0;
    const hasQuantityDraft = draftValue.length > 0;

    if (!hasQuantityDraft && !hasNote) {
      return;
    }

    if (hasNote && /[;,]/.test(note)) {
      setAdminError("Comment cannot contain commas or semicolons.");
      return;
    }

    let quantity: number | undefined;
    if (hasQuantityDraft) {
      if (!/^-?\d+$/.test(draftValue)) {
        setAdminError("Stock must be an integer.");
        return;
      }

      quantity = Number(draftValue);
      if (!Number.isSafeInteger(quantity)) {
        setAdminError("Stock must be an integer.");
        return;
      }
    }

    const currentQuantity =
      stockSnapshot?.items.find((item) => item.productId === productId)?.quantity;
    if (
      typeof currentQuantity === "number" &&
      quantity === currentQuantity &&
      !hasNote
    ) {
      return;
    }

    setAdminError(null);
    setAdminLoading(true);
    try {
      const response = await client.admin.setStock({
        password: adminSessionPassword,
        productId,
        quantity,
        note: hasNote ? note : undefined,
        action: hasQuantityDraft ? "set" : "comment"
      });
      setStockSnapshot(response);
      setStockDraftByProductId(
        Object.fromEntries(response.items.map((item) => [item.productId, ""]))
      );
      setStockNoteByProductId((current) => ({ ...current, [productId]: "" }));
    } catch {
      setAdminError("Could not update stock.");
    } finally {
      setAdminLoading(false);
    }
  };

  const markStockCountedOk = async (productId: string) => {
    if (!adminSessionPassword) {
      setAdminError("Admin session expired. Please unlock again.");
      return;
    }

    const currentQuantity =
      stockSnapshot?.items.find((item) => item.productId === productId)?.quantity;
    if (typeof currentQuantity !== "number") {
      setAdminError("Could not resolve current stock for this product.");
      return;
    }

    const note = stockNoteByProductId[productId]?.trim();
    if (note && /[;,]/.test(note)) {
      setAdminError("Comment cannot contain commas or semicolons.");
      return;
    }

    setAdminError(null);
    setAdminLoading(true);
    try {
      const response = await client.admin.setStock({
        password: adminSessionPassword,
        productId,
        quantity: currentQuantity,
        action: "counted_ok",
        note: note || undefined
      });
      setStockSnapshot(response);
      setStockDraftByProductId(
        Object.fromEntries(response.items.map((item) => [item.productId, ""]))
      );
      setStockNoteByProductId((current) => ({ ...current, [productId]: "" }));
    } catch {
      setAdminError("Could not mark product as counted and correct.");
    } finally {
      setAdminLoading(false);
    }
  };

  const lockAdminPanel = () => {
    setAdminTransactions(null);
    setStockSnapshot(null);
    setStockDraftByProductId({});
    setStockNoteByProductId({});
    setStockProductQuery("");
    setStockCurrentValueFilter("");
    setAdminCustomers([]);
    setCreditLedger([]);
    setAdminCreditEvents([]);
    setSelectedMemberId("");
    setAdminSessionPassword("");
    setAdminPassword("");
    setAdminError(null);
    setAdminStatusFilter("all");
    setAdminProductFilter("all");
    setAdminFromDate("");
    setAdminToDate("");
    setAdminTab("transactions");
  };

  const downloadAdminCsv = () => {
    const csv = buildTransactionsCsv(adminFilteredTransactions);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `transactions-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadFilteredStockEventsCsv = () => {
    if (!stockSnapshot) {
      return;
    }

    const productNameById = new Map(
      stockSnapshot.items.map((item) => [item.productId, item.productName])
    );
    const csv = buildStockEventsCsv(filteredStockEvents, productNameById);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `stock-events-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadFilteredStockCountsCsv = () => {
    const csv = buildStockCountsCsv(filteredStockItems);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `stock-counts-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleAdminMode = () => {
    if (uiMode === "pos") {
      setUiMode("admin");
      setAdminError(null);
      setShowMobileMenu(false);
      return;
    }

    lockAdminPanel();
    setUiMode("pos");
    setShowMobileMenu(false);
  };

  const toggleTheme = () => {
    setIsDark((value) => !value);
  };

  const showBackToCart = uiMode === "admin" || view !== "cart";
  const handleBackToCart = () => {
    if (uiMode === "admin") {
      toggleAdminMode();
      return;
    }

    setView("cart");
    setTransaction(null);
    setShowCheckoutConfirm(false);
  };

  return (
    <div className="min-h-screen px-3 py-6 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <header className="sticky top-0 z-30 rounded-2xl border border-black/10 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
          <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap">
            <h1 className="text-base font-semibold">Cashier</h1>
            <button
              type="button"
              onClick={showBackToCart ? handleBackToCart : toggleAdminMode}
              className="hidden sm:inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600 dark:hover:border-slate-300"
            >
              {showBackToCart ? "Back to Cart" : "Admin panel"}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="hidden sm:inline-flex rounded-full border border-slate-300 px-3 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600 dark:hover:border-slate-300"
              aria-label="Toggle theme"
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            >
              {isDark ? "☀️" : "🌙"}
            </button>

            {uiMode === "pos" && view === "cart" && (
              <div className="flex items-center gap-3 sm:ml-auto">
                <button
                  type="button"
                  onClick={openCheckoutConfirm}
                  disabled={!hasCheckoutItems || isBusy}
                  className="rounded-full bg-accent-light px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-dark dark:text-slate-900"
                >
                  <span className="sm:hidden">Pay ({currencyFormatter.format(cartExternalDuePreview)})</span>
                  <span className="hidden sm:inline">Checkout ({currencyFormatter.format(cartExternalDuePreview)})</span>
                </button>
              </div>
            )}

            {showBackToCart && (
              <button
                type="button"
                onClick={handleBackToCart}
                className="ml-auto inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm transition hover:border-slate-500 sm:hidden dark:border-slate-600 dark:hover:border-slate-300"
              >
                Back to Cart
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowMobileMenu(true)}
              className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-lg transition hover:border-slate-500 dark:border-slate-600 dark:hover:border-slate-300"
              aria-label="Open menu"
            >
              ☰
            </button>
          </div>
        </header>

        {showMobileMenu && (
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setShowMobileMenu(false)}
          >
            <aside
              className="ml-auto flex h-full w-72 flex-col gap-3 border-l border-black/10 bg-white p-4 dark:border-white/10 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Menu</p>
                <button
                  type="button"
                  onClick={() => setShowMobileMenu(false)}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs transition hover:border-slate-500 dark:border-slate-600 dark:hover:border-slate-300"
                >
                  Close
                </button>
              </div>

              <button
                type="button"
                onClick={toggleAdminMode}
                className="rounded-xl border border-slate-300 px-4 py-3 text-left text-sm font-semibold transition hover:border-slate-500 dark:border-slate-600 dark:hover:border-slate-300"
              >
                Admin Panel
              </button>

              {uiMode === "pos" && memberCreditEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setView("topup");
                    setTransaction(null);
                    setShowMobileMenu(false);
                  }}
                  className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-left text-sm font-semibold text-sky-700 transition hover:border-sky-500 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200"
                >
                  Top up credit
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setShowMobileMenu(false);
                }}
                className="rounded-xl border border-slate-300 px-4 py-3 text-left text-sm font-semibold transition hover:border-slate-500 dark:border-slate-600 dark:hover:border-slate-300"
              >
                {isDark ? "Switch to light theme ☀️" : "Switch to dark theme 🌙"}
              </button>

              <button
                type="button"
                onClick={() => setMemberCreditEnabled((value) => !value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-left text-sm font-semibold transition hover:border-slate-500 dark:border-slate-600 dark:hover:border-slate-300"
              >
                Member credit feature: {memberCreditEnabled ? "On" : "Off"}
              </button>
            </aside>
          </div>
        )}

        {uiMode === "pos" && status && (
          <div
            className={`rounded-lg px-4 py-2 text-sm ${
              status.tone === "error"
                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
            }`}
          >
            {status.text}
          </div>
        )}
        {uiMode === "admin" && adminError && (
          <div className="rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
            {adminError}
          </div>
        )}
        {updateReady && (
          <div className="rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
            Update available. Page will refresh automatically when no items are selected.
          </div>
        )}

        {uiMode === "admin" ? (
          <section className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
            {!adminTransactions ? (
              <form
                className="mx-auto flex w-full max-w-md flex-col gap-4"
                autoComplete="on"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadAdminTransactions();
                }}
              >
                <h2 className="text-lg font-semibold">Unlock admin panel</h2>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Submit the admin password to access transaction history, stock management,
                  and CSV export.
                </p>
                <input
                  type="text"
                  name="admin_unlock_user"
                  value={adminUnlockUsername}
                  readOnly
                  autoComplete="username"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="hidden"
                />
                <input
                  type="password"
                  name="admin_unlock_password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder="Admin password"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  autoComplete="current-password"
                />
                <button
                  type="submit"
                  disabled={adminLoading || adminPassword.length === 0}
                  className="rounded-xl bg-accent-light px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-dark dark:text-slate-900"
                >
                  {adminLoading ? "Unlocking..." : "Login"}
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminTab("transactions")}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      adminTab === "transactions"
                        ? "bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900"
                        : "border border-slate-300 hover:border-slate-500 dark:border-slate-600"
                    }`}
                  >
                    Transactions
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminTab("stock")}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      adminTab === "stock"
                        ? "bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900"
                        : "border border-slate-300 hover:border-slate-500 dark:border-slate-600"
                    }`}
                  >
                    Stock
                  </button>
                  {memberCreditEnabled && (
                    <button
                      type="button"
                      onClick={() => setAdminTab("members")}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        adminTab === "members"
                          ? "bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900"
                          : "border border-slate-300 hover:border-slate-500 dark:border-slate-600"
                      }`}
                    >
                      Customers
                    </button>
                  )}
                </div>
                {adminTab === "transactions" && (
                <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Transactions
                      {hasActiveFilters && (
                        <span className="ml-1 normal-case tracking-normal text-slate-400">
                          (Filtered)
                        </span>
                      )}
                    </p>
                    <p className="mt-2 text-xl font-semibold">{adminTotals.count}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Completed
                      {hasActiveFilters && (
                        <span className="ml-1 normal-case tracking-normal text-slate-400">
                          (Filtered)
                        </span>
                      )}
                    </p>
                    <p className="mt-2 text-xl font-semibold">{adminTotals.completed}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Canceled
                      {hasActiveFilters && (
                        <span className="ml-1 normal-case tracking-normal text-slate-400">
                          (Filtered)
                        </span>
                      )}
                    </p>
                    <p className="mt-2 text-xl font-semibold">{adminTotals.canceled}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Amount
                      {hasActiveFilters && (
                        <span className="ml-1 normal-case tracking-normal text-slate-400">
                          (Filtered)
                        </span>
                      )}
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {currencyFormatter.format(adminTotals.amount)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={lockAdminPanel}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:border-slate-500 dark:border-slate-600"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={downloadAdminCsv}
                    disabled={adminFilteredTransactions.length === 0}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
                  >
                    Download CSV (filtered)
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-7">
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      Status
                    </span>
                    <select
                      value={adminStatusFilter}
                      onChange={(event) =>
                        setAdminStatusFilter(
                          event.target.value as "all" | TransactionStatus
                        )
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="canceled">Canceled</option>
                      <option value="abandoned">Abandoned</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      Product
                    </span>
                    <select
                      value={adminProductFilter}
                      onChange={(event) => setAdminProductFilter(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <option value="all">All</option>
                      {adminProductOptions.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      Item text
                    </span>
                    <input
                      type="search"
                      value={adminItemQuery}
                      onChange={(event) => setAdminItemQuery(event.target.value)}
                      placeholder="Name or id"
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      From
                    </span>
                    <input
                      type="date"
                      value={adminFromDate}
                      onChange={(event) => setAdminFromDate(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-xs uppercase tracking-wide text-slate-500">To</span>
                    <input
                      type="date"
                      value={adminToDate}
                      onChange={(event) => setAdminToDate(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const to = today.toISOString().slice(0, 10);
                        const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
                        setAdminFromDate(from.toISOString().slice(0, 10));
                        setAdminToDate(to);
                      }}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600"
                    >
                      Last 24h
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminStatusFilter("all");
                        setAdminProductFilter("all");
                        setAdminItemQuery("");
                        setAdminFromDate("");
                        setAdminToDate("");
                      }}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600"
                    >
                      Reset filters
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-800/40">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">ID</th>
                        <th className="px-3 py-2 text-left font-semibold">Date</th>
                        <th className="px-3 py-2 text-left font-semibold">Type</th>
                        <th className="px-3 py-2 text-left font-semibold">Status</th>
                        <th className="px-3 py-2 text-right font-semibold">Total</th>
                        <th className="px-3 py-2 text-left font-semibold">Items</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {adminFilteredTransactions.map((entry) => (
                        <tr key={entry.id}>
                          <td
                            className="max-w-28 truncate px-3 py-2 font-mono text-xs"
                            title={entry.id}
                          >
                            {entry.id}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {formatAdminDate(entry.createdAt)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {entry.type === "credit_topup" ? "credit_topup" : "sale"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">{entry.status}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            {currencyFormatter.format(entry.total)}
                          </td>
                          <td className="px-3 py-2 text-left font-mono text-xs">
                            {buildCartBreakdownJson(entry)}
                          </td>
                        </tr>
                      ))}
                      {adminFilteredTransactions.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-6 text-center text-slate-500 dark:text-slate-300"
                          >
                            No transactions match current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </>
                )}

                {memberCreditEnabled && adminTab === "members" && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <h3 className="text-sm font-semibold">Create customer</h3>
                      <div className="mt-3 grid gap-2">
                        <input
                          type="text"
                          autoComplete="off"
                          value={adminMemberName}
                          onChange={(event) => setAdminMemberName(event.target.value)}
                          placeholder="Display name"
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                        />
                        <select
                          value={adminCustomerType}
                          onChange={(event) =>
                            setAdminCustomerType(event.target.value as "member" | "non_member")
                          }
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <option value="member">Member customer</option>
                          <option value="non_member">Non-member customer</option>
                        </select>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="one-time-code"
                          value={adminMemberPin}
                          onChange={(event) => setAdminMemberPin(event.target.value.replace(/\D+/g, ""))}
                          placeholder="PIN (4+ digits)"
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => void createAdminMember()}
                          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
                          disabled={adminLoading}
                        >
                          Add customer
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <h3 className="text-sm font-semibold">Customers</h3>
                      <div className="mt-3 max-h-64 overflow-auto space-y-2">
                        {adminCustomers.map((member) => (
                          <button
                            type="button"
                            key={member.id}
                            onClick={() => {
                              setSelectedMemberId(member.id);
                              void loadAdminCustomers(adminSessionPassword, member.id);
                            }}
                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                              selectedMemberId === member.id
                                ? "border-sky-500 bg-sky-50/60 dark:bg-sky-900/20"
                                : "border-slate-300 hover:border-slate-500 dark:border-slate-600"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{member.displayName}</span>
                              <span>{currencyFormatter.format(member.balance)}</span>
                            </div>
                            <div className="text-xs text-slate-500">
                              {member.customerType === "member" ? "Member" : "Non-member"} · {member.active ? "Active" : "Disabled"}
                            </div>
                          </button>
                        ))}
                        {adminCustomers.length === 0 && (
                          <p className="text-sm text-slate-500">No customers yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 lg:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold">
                          {selectedAdminMember ? `${selectedAdminMember.displayName} • Credit tools` : "Select a customer"}
                        </h3>
                        {selectedAdminMember && (
                          <button
                            type="button"
                            onClick={() => void toggleSelectedMemberActive()}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold transition hover:border-slate-500 dark:border-slate-600"
                          >
                            {selectedAdminMember.active ? "Disable" : "Enable"}
                          </button>
                        )}
                      </div>

                      {selectedAdminMember && (
                        <>
                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <input
                              type="number"
                              min={0.01}
                              step="0.01"
                              value={memberTopupAmount}
                              onChange={(event) => setMemberTopupAmount(event.target.value)}
                              placeholder="Top-up amount"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            />
                            <input
                              type="text"
                              value={memberTopupNote}
                              onChange={(event) => setMemberTopupNote(event.target.value)}
                              placeholder="Note (optional)"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => void topupSelectedMember()}
                              className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
                              disabled={adminLoading}
                            >
                              Top up credit
                            </button>
                          </div>

                          <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Selected customer ledger</p>
                            <ul className="mt-2 space-y-1 text-sm">
                              {creditLedger.map((entry) => (
                                <li key={entry.id} className="flex items-center justify-between gap-2">
                                  <span className="truncate text-slate-600 dark:text-slate-300">
                                    {formatAdminDate(entry.createdAt)} • {entry.reason}
                                    {entry.note ? ` (${entry.note})` : ""}
                                  </span>
                                  <span className={entry.delta >= 0 ? "text-emerald-500" : "text-rose-500"}>
                                    {entry.delta >= 0 ? "+" : ""}
                                    {currencyFormatter.format(entry.delta)}
                                  </span>
                                </li>
                              ))}
                              {creditLedger.length === 0 && (
                                <li className="text-slate-500">No credit events yet.</li>
                              )}
                            </ul>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 lg:col-span-2">
                      <h3 className="text-sm font-semibold">Customer credit events</h3>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                          <thead className="bg-slate-50 dark:bg-slate-800/40">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">Date</th>
                              <th className="px-3 py-2 text-left font-semibold">Member</th>
                              <th className="px-3 py-2 text-left font-semibold">Reason</th>
                              <th className="px-3 py-2 text-left font-semibold">Transaction</th>
                              <th className="px-3 py-2 text-left font-semibold">Item breakdown</th>
                              <th className="px-3 py-2 text-right font-semibold">Delta</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {adminCreditEvents.map((entry) => {
                              const memberName =
                                adminCustomers.find((member) => member.id === entry.memberId)?.displayName ??
                                entry.memberId;
                              return (
                                <tr key={entry.id}>
                                  <td className="whitespace-nowrap px-3 py-2">{formatAdminDate(entry.createdAt)}</td>
                                  <td className="whitespace-nowrap px-3 py-2">{memberName}</td>
                                  <td className="whitespace-nowrap px-3 py-2">{entry.reason}</td>
                                  <td className="px-3 py-2 font-mono text-xs">{entry.transactionId ?? "-"}</td>
                                  <td className="px-3 py-2 font-mono text-xs">
                                    {entry.itemBreakdown ? JSON.stringify(entry.itemBreakdown) : "-"}
                                  </td>
                                  <td className={`whitespace-nowrap px-3 py-2 text-right ${entry.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                    {entry.delta >= 0 ? "+" : ""}
                                    {currencyFormatter.format(entry.delta)}
                                  </td>
                                </tr>
                              );
                            })}
                            {adminCreditEvents.length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-slate-500 dark:text-slate-300">
                                  No customer credit events yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {adminTab === "stock" && stockSnapshot && (
                  <div className="flex flex-col gap-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <label className="flex flex-col gap-2 text-sm">
                        <span className="text-xs uppercase tracking-wide text-slate-500">
                          Product
                        </span>
                        <input
                          type="search"
                          value={stockProductQuery}
                          onChange={(event) => setStockProductQuery(event.target.value)}
                          placeholder="Name or id"
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm">
                        <span className="text-xs uppercase tracking-wide text-slate-500">
                          Current value
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="-?[0-9]*"
                          value={stockCurrentValueFilter}
                          onChange={(event) => {
                            const next = event.target.value;
                            if (!/^-?\d*$/.test(next)) {
                              return;
                            }
                            setStockCurrentValueFilter(next);
                          }}
                          placeholder="Exact quantity"
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={downloadFilteredStockEventsCsv}
                          disabled={filteredStockEvents.length === 0}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
                        >
                          Export stock events CSV
                        </button>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={downloadFilteredStockCountsCsv}
                          disabled={filteredStockItems.length === 0}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
                        >
                          Export current stock CSV
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-800/40">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Product</th>
                            <th className="px-3 py-2 text-right font-semibold">Current</th>
                            <th className="px-3 py-2 text-right font-semibold">New stock</th>
                            <th className="px-3 py-2 text-left font-semibold">Note</th>
                            <th className="px-3 py-2 text-right font-semibold">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {filteredStockItems.map((item) => {
                            const draftValue = stockDraftByProductId[item.productId] ?? "";
                            const trimmedDraft = draftValue.trim();
                            const isEmptyDraft = trimmedDraft.length === 0;
                            const isValidInteger = isEmptyDraft || /^-?\d+$/.test(trimmedDraft);
                            const parsedDraft = /^-?\d+$/.test(trimmedDraft)
                              ? Number(trimmedDraft)
                              : NaN;
                            const hasChanged = !isEmptyDraft && parsedDraft !== item.quantity;
                            const noteValue = stockNoteByProductId[item.productId] ?? "";
                            const trimmedNote = noteValue.trim();
                            const hasNoteOnly = hasChanged === false && trimmedNote.length > 0;
                            const canSubmit = hasChanged || hasNoteOnly;
                            const actionLabel = hasNoteOnly ? "Add comment" : "Update stock";

                            return (
                              <tr key={item.productId}>
                                <td className="px-3 py-2">{item.productName}</td>
                                <td className="px-3 py-2 text-right font-semibold">{item.quantity}</td>
                                <td className="px-3 py-2 text-right">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="-?[0-9]*"
                                    data-stock-input="true"
                                    placeholder={String(item.quantity)}
                                    value={draftValue}
                                    onKeyDown={(event) => {
                                      if (event.key === "ArrowDown") {
                                        moveStockInputFocus(event, 1);
                                      }
                                      if (event.key === "ArrowUp") {
                                        moveStockInputFocus(event, -1);
                                      }
                                    }}
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      if (!/^-?\d*$/.test(nextValue)) {
                                        return;
                                      }
                                      setStockDraftByProductId((current) => ({
                                        ...current,
                                        [item.productId]: nextValue
                                      }));
                                    }}
                                    className={`w-24 rounded-lg border px-2 py-1 text-right dark:border-slate-600 dark:bg-slate-900 ${
                                      hasChanged
                                        ? "border-accent-light text-slate-900 dark:border-accent-dark dark:text-slate-100"
                                        : "border-slate-300 text-slate-900 dark:text-slate-100"
                                    }`}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={stockNoteByProductId[item.productId] ?? ""}
                                    placeholder="Comment"
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      if (/[;,]/.test(nextValue)) {
                                        return;
                                      }
                                      setStockNoteByProductId((current) => ({
                                        ...current,
                                        [item.productId]: nextValue
                                      }));
                                    }}
                                    className="w-full rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
                                  />
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void markStockCountedOk(item.productId)}
                                      disabled={isBusy}
                                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600"
                                    >
                                      Counted OK
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void updateStock(item.productId)}
                                      disabled={!canSubmit || !isValidInteger || isBusy}
                                      className="rounded-lg bg-accent-light px-3 py-1 text-xs font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-accent-dark dark:text-slate-900"
                                    >
                                      {actionLabel}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredStockItems.length === 0 && (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-3 py-6 text-center text-slate-500 dark:text-slate-300"
                              >
                                No stock items match current filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <h3 className="text-sm font-semibold">Recent stock events</h3>
                      <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        {filteredStockEvents.slice(0, 12).map((event) => (
                          <li key={event.id}>
                            {new Date(event.createdAt).toLocaleString()} — {event.productId} — {event.type} {event.quantity}
                            {event.note ? ` (${event.note})` : ""}
                          </li>
                        ))}
                        {filteredStockEvents.length === 0 && <li>No stock events for current filter.</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : view === "cart" ? (
          <section>
            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Products</h2>
                <div className="flex items-center gap-3 rounded-full border border-slate-200 px-3 py-1 text-xs uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-200">
                  <span>{defaultIsMemberPrice ? "Member price" : "Non-member price"}</span>
                  <button
                    type="button"
                    onClick={() => setDefaultIsMemberPrice((value) => !value)}
                    className={`relative h-6 w-12 rounded-full transition ${
                      defaultIsMemberPrice
                        ? "bg-accent-light dark:bg-accent-dark"
                        : "bg-slate-300 dark:bg-slate-700"
                    }`}
                    aria-pressed={defaultIsMemberPrice}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                        defaultIsMemberPrice ? "left-7" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search products"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>

              <div className="mt-4 flex flex-col gap-4">
                {filteredProducts.length === 0 && (
                  <p className="text-sm text-slate-500">
                    {products.length === 0
                      ? "No products configured."
                      : "No products match search."}
                  </p>
                )}
                {filteredProducts.map((product) => {
                  const unitPrice = getUnitPrice(
                    product,
                    priceCategories,
                    defaultIsMemberPrice
                  );
                  const quantity = getQuantity(product.id, defaultIsMemberPrice);

                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 border-b border-black/5 pb-3 last:border-b-0 dark:border-white/10"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-medium break-words">
                          {product.name}{" "}
                          <span className="text-xs uppercase text-slate-500">
                            {formatPriceMode(defaultIsMemberPrice)}
                          </span>
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-300">
                          {currencyFormatter.format(unitPrice)} - stock{" "}
                          {product.inventoryCount}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 self-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(product.id, -1, defaultIsMemberPrice)
                          }
                          className="h-10 w-10 rounded-xl border border-slate-300 text-xl leading-none transition hover:border-slate-500 dark:border-slate-600"
                        >
                          -
                        </button>
                        <span className="w-5 text-center text-sm font-semibold">{quantity}</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(product.id, 1, defaultIsMemberPrice)
                          }
                          className="h-10 w-10 rounded-xl border border-slate-300 text-xl leading-none transition hover:border-slate-500 dark:border-slate-600"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-6">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h2 className="text-lg font-semibold">
                {isTopupView ? "Top up customer credit" : "Pay at the fridge"}
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                {isTopupView
                  ? "Scan the QR code to add credit. When done, press \"I paid\"."
                  : "Scan the QR code and pay the total. When done, press \"I paid\"."}
              </p>

              {isTopupView && activeMember && (
                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Customer: <span className="font-semibold">{activeMember.displayName}</span>
                </div>
              )}

              {isTopupView && !transaction && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  <p className="text-sm font-semibold">Setup top-up</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    Customer list is public. Enter PIN to unlock details and top-up amount.
                  </p>

                  <input
                    type="search"
                    value={topupMemberQuery}
                    onChange={(event) => setTopupMemberQuery(event.target.value)}
                    placeholder="Search customer"
                    className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900"
                  />

                  <div className="mt-2 max-h-36 overflow-auto space-y-1">
                    {filteredPublicCustomers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          setSelectedTopupMemberId(member.id);
                          if (activeMember?.id !== member.id) {
                            setActiveMember(null);
                          }
                        }}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                          selectedTopupMemberId === member.id
                            ? "border-sky-500 bg-sky-50/60 dark:bg-sky-900/20"
                            : "border-slate-300 hover:border-slate-500 dark:border-slate-600"
                        }`}
                      >
                        {member.displayName}
                      </button>
                    ))}
                    {filteredPublicCustomers.length === 0 && (
                      <p className="text-sm text-slate-500">No members found.</p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {selectedTopupMember && (
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        Selected customer: {selectedTopupMember.displayName}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    {[5, 10, 20].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTopupAmount(value.toFixed(2))}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600"
                      >
                        € {value}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={topupAmount}
                      onChange={(event) => setTopupAmount(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900"
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void startTopup()}
                      disabled={!selectedTopupMember || isBusy}
                      className="rounded-xl bg-accent-light px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50 dark:bg-accent-dark dark:text-slate-900"
                    >
                      Start top-up payment
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("cart")}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600"
                    >
                      Back to cart
                    </button>
                  </div>
                </div>
              )}

              {transaction && (
                <>
              <div className="mt-6 rounded-2xl border border-dashed border-slate-400/60 p-6 text-center dark:border-slate-500">
                {qrImageSrc ? (
                  <img
                    className="mx-auto block h-56 w-56 rounded bg-white"
                    src={qrImageSrc}
                    alt="Payment QR"
                  />
                ) : (
                  <div className="mx-auto h-56 w-56 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
                )}
              </div>
              {hasMemberPricedItemsInCheckout && (
                <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 dark:border-amber-700 dark:bg-amber-900/20">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Member-priced items require customer username + PIN
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <select
                      value={memberPricingCustomerId}
                      onChange={(event) => {
                        setMemberPricingCustomerId(event.target.value);
                        setMemberPricingAuthMode("none");
                        setActiveMember(null);
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900"
                    >
                      <option value="">Select customer username</option>
                      {publicCustomers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.displayName}
                        </option>
                      ))}
                    </select>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      value={memberPinInput}
                      onChange={(event) => setMemberPinInput(event.target.value.replace(/\D+/g, ""))}
                      placeholder="Customer PIN"
                      disabled={!memberPricingCustomerId}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => void authenticateMemberPin()}
                      disabled={!memberPricingCustomerId}
                      className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-700 transition hover:border-amber-500 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                    >
                      Verify with PIN
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={acceptMemberPricingWithUsernameOnly}
                      disabled={!memberPricingCustomerId}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm transition hover:border-slate-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900"
                    >
                      Continue with username only (for now)
                    </button>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      Status: {memberPricingAuthMode === "pin"
                        ? "verified by PIN"
                        : memberPricingAuthMode === "username_only"
                          ? "username-only accepted"
                          : "not verified"}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playCashierCloseSound(isDark);
                    void finalize("completed");
                  }}
                  disabled={isBusy || paymentBlockedByMemberAuth}
                  className="rounded-xl bg-emerald-500 px-6 py-3 text-base font-bold text-white transition hover:brightness-95 disabled:opacity-50"
                >
                  I paid
                </button>
                <button
                  type="button"
                  onClick={() => finalize("canceled")}
                  disabled={isBusy}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
                >
                  Cancel
                </button>
                {memberCreditEnabled && (
                  <button
                    type="button"
                    onClick={() => setShowPayWithCreditModal(true)}
                    disabled={isBusy || paymentBlockedByMemberAuth}
                    className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:border-sky-500 disabled:opacity-50 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200"
                  >
                    Pay with customer credit
                  </button>
                )}
              </div>
              {paymentBlockedByMemberAuth && (
                <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">
                  Payment is locked until member-priced items are verified with customer username + PIN (or username-only fallback).
                </p>
              )}

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Manual transfer details
                </p>
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {isTopupView ? "Top-up amount" : "Amount due (external)"}
                  </p>
                  <p className="text-xl font-semibold">
                    {currencyFormatter.format(checkoutExternalAmount)}
                  </p>
                </div>
                {!isTopupView && checkoutCreditUsed > 0 && (
                  <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    Credit used: <span className="font-semibold">{currencyFormatter.format(checkoutCreditUsed)}</span>
                    {transaction?.memberName ? ` (${transaction.memberName})` : ""}
                  </div>
                )}
                {structuredCommunication && (
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Gestructureerde mededeling
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {structuredCommunication}
                    </p>
                  </div>
                )}
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Bank account
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {paymentIbanName}
                  </p>
                  <p className="font-mono text-sm text-slate-700 dark:text-slate-200">
                    {paymentIbanNumber}
                  </p>
                </div>
              </div>
                </>
              )}
            </div>
            <aside className="rounded-2xl border border-black/10 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h2 className="text-lg font-semibold">This transaction</h2>
              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
                {transaction?.items.map((item) => (
                  <div
                    key={`${item.productId}-${item.isMemberPrice}`}
                    className="flex items-center justify-between"
                  >
                    <span>
                      {item.name} {formatPriceMode(item.isMemberPrice)} x{" "}
                      {item.quantity}
                    </span>
                    <span>{currencyFormatter.format(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-black/10 pt-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                {transaction?.items.some((item) => item.isMemberPrice) &&
                transaction?.items.some((item) => !item.isMemberPrice)
                  ? "Mixed pricing applied"
                  : transaction?.items.some((item) => item.isMemberPrice)
                    ? "Member pricing applied"
                    : "Regular pricing applied"}
                <div className="mt-3 space-y-1">
                  <div>Total: {transaction ? currencyFormatter.format(transaction.total) : "-"}</div>
                  <div>Credit: {currencyFormatter.format(checkoutCreditUsed)}</div>
                  <div>External: {currencyFormatter.format(checkoutExternalAmount)}</div>
                </div>
              </div>
            </aside>
          </section>
        )}

        {memberCreditEnabled && transaction && showPayWithCreditModal && (
          <div
            className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-6"
            onClick={() => setShowPayWithCreditModal(false)}
          >
            <div
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">Pay with customer credit</h3>
              <input
                type="search"
                value={paymentMemberQuery}
                onChange={(event) => setPaymentMemberQuery(event.target.value)}
                placeholder="Search customer"
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900"
              />

              <div className="mt-2 max-h-36 overflow-auto space-y-1">
                {filteredPaymentCustomers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      setSelectedPaymentMemberId(member.id);
                      setPayWithCreditModalError(null);
                      if (activeMember?.id !== member.id) {
                        setActiveMember(null);
                      }
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selectedPaymentMemberId === member.id
                        ? "border-sky-500 bg-sky-50/60 dark:bg-sky-900/20"
                        : "border-slate-300 hover:border-slate-500 dark:border-slate-600"
                    }`}
                  >
                    {member.displayName}
                  </button>
                ))}
              </div>

              {payWithCreditModalError && (
                <div className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                  {payWithCreditModalError}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  value={memberPinInput}
                  onChange={(event) => setMemberPinInput(event.target.value.replace(/\D+/g, ""))}
                  placeholder="Customer PIN"
                  disabled={!selectedPaymentMember}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={() => void authenticateMemberPin()}
                  disabled={!selectedPaymentMember}
                  className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500 disabled:opacity-50 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200"
                >
                  Unlock
                </button>
              </div>

              {activeMember && selectedPaymentMember && activeMember.id === selectedPaymentMember.id && (
                <div className="mt-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <div className="font-medium">{activeMember.displayName}</div>
                  <div className="text-slate-500 dark:text-slate-300">
                    Balance: {currencyFormatter.format(activeMember.balance)}
                  </div>
                  <button
                    type="button"
                    onClick={() => void payTransactionWithMemberCredit()}
                    className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                  >
                    Pay
                  </button>
                  {activeMember.balance < transaction.total && (
                    <button
                      type="button"
                      onClick={() => {
                        const shortfall = Math.max(0, transaction.total - activeMember.balance);
                        setTopupAmount(Math.max(5, Math.ceil(shortfall)).toFixed(2));
                        setSelectedTopupMemberId(activeMember.id);
                        setShowPayWithCreditModal(false);
                        setTransaction(null);
                        setView("topup");
                      }}
                      className="mt-2 w-full rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200"
                    >
                      Not enough credit — Top up first
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {uiMode === "pos" && view === "cart" && showCheckoutConfirm && (
          <div
            className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-6"
            onClick={() => setShowCheckoutConfirm(false)}
          >
            <div
              className="w-full max-w-2xl rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Confirm checkout</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    Review and edit your cart before generating the payment QR.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playCashierOpenSound(isDark);
                    void startCheckout();
                  }}
                  disabled={!hasCheckoutItems || isBusy}
                  className="rounded-xl bg-accent-light px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-dark dark:text-slate-900"
                >
                  Confirm ({currencyFormatter.format(cartExternalDuePreview)})
                </button>
              </div>

              <div className="mt-4 max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                {cartItemsForCheckout.length === 0 ? (
                  <p className="text-sm text-slate-500">Your cart is empty.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {cartItemsForCheckout.map((item) => (
                      <div
                        key={`${item.productId}-${item.isMemberPrice}`}
                        className="flex items-center justify-between gap-3 border-b border-black/5 pb-3 last:border-b-0 dark:border-white/10"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-medium break-words">
                            {item.name}{" "}
                            <span className="text-xs uppercase text-slate-500">
                              {formatPriceMode(item.isMemberPrice)}
                            </span>
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-300">
                            {currencyFormatter.format(item.unitPrice)}
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5 self-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuantityChange(item.productId, -1, item.isMemberPrice)
                            }
                            className="h-10 w-10 rounded-xl border border-slate-300 text-xl leading-none transition hover:border-slate-500 dark:border-slate-600"
                          >
                            -
                          </button>
                          <span className="w-5 text-center text-sm font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleQuantityChange(item.productId, 1, item.isMemberPrice)
                            }
                            className="h-10 w-10 rounded-xl border border-slate-300 text-xl leading-none transition hover:border-slate-500 dark:border-slate-600"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="text-slate-600 dark:text-slate-300">Total</p>
                  <p className="font-semibold">{totalLabel}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-slate-600 dark:text-slate-300">Credit</p>
                  <p className="font-semibold">{currencyFormatter.format(cartCreditPreview)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-slate-600 dark:text-slate-300">External due</p>
                  <p className="text-xl font-semibold">{currencyFormatter.format(cartExternalDuePreview)}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCart([]);
                    setShowCheckoutConfirm(false);
                  }}
                  disabled={isBusy || cartItemsForCheckout.length === 0}
                  className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-600 dark:text-rose-300"
                >
                  Clear cart
                </button>
                <button
                  type="button"
                  onClick={() => setShowCheckoutConfirm(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 dark:border-slate-600 dark:text-slate-200"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        )}
        <footer className="pb-2 text-center text-xs text-slate-500 dark:text-slate-400">
          Frontend commit: <span className="font-mono">{APP_VERSION}</span>
        </footer>
      </div>
    </div>
  );
}
