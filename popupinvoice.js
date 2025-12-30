// ==============================
// popupinvoice.js
// ==============================
$(document).ready(function () {
    console.log("popupinvoice.js loaded ✅");
    
    // Kill anonymous overlay / shadow
    $("#shadow").hide();

    // -----------------------------
    // OPEN POPUP
    // -----------------------------
    window.openInvoicePopup = function (currentUser, entity) {
        console.log("openInvoicePopup:", currentUser, entity);
        window._currentEntity = entity;

        if ($("#zone4-invoice").length === 0) {
            console.error("popupinvoice.html not included in page!");
            return;
        }

        $("#zone4").children().hide();
        $("#zone4-invoice").show();
        $("body").css("overflow", "hidden");

        fillInvoiceHeader(currentUser);
        loadInvoiceTab(currentUser, entity);
        loadReportTab(currentUser, entity);
        loadTransactionsTab(currentUser, entity);
        fillEmailTab(currentUser, entity);
    };

    // -----------------------------
    // FILL HEADER
    // -----------------------------
    function fillInvoiceHeader(user) {
        $("#inv-username").text(user.username || "");
        $("#inv-email").text(user.email || "");
        $("#inv-role").text(user.role ? `Role: ${user.role}` : "");
        $("#inv-user-id").text(user.id || "");
        $("#rep-user-id").text(user.id || "");
        $("#trans-user-id").text(user.id || ""); 
    }

    // -----------------------------
    // TAB 1: INVOICE
    // -----------------------------
    async function loadInvoiceTab(user, entity) {
        const tbody = $("#inv-table tbody");
        tbody.empty();
        try {
            const resp = await fetch(`/get-client-invoices?username=${encodeURIComponent(user.username)}&entity=${entity || ''}`);
            const data = await resp.json();
            const invoices = data.invoices || [];

            if (!invoices.length) {
                tbody.html("<tr><td colspan='8'>No invoices</td></tr>");
                loadInvoiceFooter([]);
                return;
            }

            invoices.forEach(inv => {
                const subscriptionText = (inv.subscription_values || []).join(', ');
                const paymentTypeText = (inv.payment_types || []).join(', ');

                tbody.append(`
                    <tr>
                        <td>${inv.InvoiceNb_id || ''}</td>
                        <td>${formatDateLong(inv.InvoiceDate)}</td>
                        <td>${formatDateLong(inv.PaymentDate)}</td>
                        <td>${(inv.Amount ?? 0).toFixed(2)}</td>
                        <td>${(inv.TaxAmount ?? 0).toFixed(2)}</td>
                        <td>${inv.Status ?? inv.status ?? ''}</td>
                        <td>${subscriptionText}</td>
                        <td>${paymentTypeText}</td>
                    </tr>
                `);
            });

            loadInvoiceFooter(invoices);

        } catch (err) {
            console.error(err);
            tbody.html("<tr><td colspan='8' class='text-danger'>Error loading invoices</td></tr>");
        }
    }

    function loadInvoiceFooter(invoices) {
        let subtotal = 0, totalTax = 0;
        invoices.forEach(inv => {
            subtotal += parseFloat(inv.Amount ?? 0);
            totalTax += parseFloat(inv.TaxAmount ?? 0);
        });
        const totalDue = subtotal + totalTax;
        const taxRate = subtotal ? (totalTax / subtotal * 100) : 0;

        $("#f-sum-amount").text(subtotal.toFixed(2) + " €");
        $("#f-sum-tax").text(totalTax.toFixed(2) + " €");
        $("#f-totaltax").text(totalDue.toFixed(2) + " €");
        $("#f-taxrate").text(taxRate.toFixed(2) + " %");
    }

    // -----------------------------
    // TAB 2: REPORT
    // -----------------------------
    async function loadReportTab(user, entity) {
        const tbody = $("#report-table tbody");
        tbody.empty();
        try {
            const resp = await fetch(`/report_invoice_data?username=${encodeURIComponent(user.username)}&entity=${entity || ''}`);
            const data = await resp.json();
            const invoices = data.invoices || [];
            const unpaid = invoices.filter(inv => (inv.Status || '').toLowerCase() === 'unpaid');

            if (!unpaid.length) {
                tbody.html("<tr><td colspan='6'>No unpaid invoices</td></tr>");
                loadReportFooter([]);
                return;
            }

            unpaid.forEach(inv => {
                const subscriptionText = (inv.subscription_values || []).join(', ');
                const paymentTypeText = (inv.payment_types || []).join(', ');

                tbody.append(`
                    <tr>
                        <td>${inv.description}</td>
                        <td>${(inv.Amount ?? 0).toFixed(2)}</td>
                        <td>${(inv.TaxAmount ?? 0).toFixed(2)}</td>
                        <td>${subscriptionText}</td>
                        <td>${inv.status}</td>
                        <td>${paymentTypeText}</td>
                    </tr>
                `);
            });

            loadReportFooter(unpaid);

        } catch (err) {
            console.error(err);
            tbody.html("<tr><td colspan='5' class='text-danger'>Error loading report</td></tr>");
        }
    }

    function loadReportFooter(reports) {
        let subtotal = 0, totalTax = 0;
        reports.forEach(r => {
            subtotal += parseFloat(r.Amount ?? 0);
            totalTax += parseFloat(r.TaxAmount ?? 0);
        });
        const totalAmount = subtotal + totalTax;
        $("#report-subtotal").text(subtotal.toFixed(2) + " €");
        $("#report-total-tax").text(totalTax.toFixed(2) + " €");
        $("#report-total-amount").text(totalAmount.toFixed(2) + " €");
    }

    // -----------------------------
    // TAB 3: EMAIL
    // -----------------------------
    function fillEmailTab(user, entity) {
        $("#email_from").val(user.email || "");
    }

    $("#sendEmailBtn").off("click").on("click", async function () {
        const to = $("#email_to").val();
        const cc = $("#email_cc").val();
        const subject = $("#email_subject").val();
        const body = $("#email_body").val();
        try {
            const resp = await fetch('/send_emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, cc, subject, body })
            });
            const result = await resp.json();
            alert(result.success ? "Email sent!" : "Error: " + result.error);
        } catch (err) {
            console.error(err);
            alert("Error sending email");
        }
    });

    // -----------------------------
    // TAB 4: TRANSACTIONS
    // -----------------------------
    async function loadTransactionsTab(user, entity) {
        const tbody = $("#transactions-table tbody");
        tbody.empty();
        tbody.html("<tr><td colspan='7'>Loading transactions...</td></tr>");

        if (!user) {
            tbody.html("<tr><td colspan='7' class='text-danger'>No user found</td></tr>");
            return;
        }

        try {
            const resp = await fetch(`/transactions_data?username=${encodeURIComponent(user.username)}&entity=${entity || ''}`);
            const data = await resp.json();
            const transactions = data.transactions || [];
            tbody.empty();

            if (!transactions.length) {
                tbody.html("<tr><td colspan='7'>No transactions</td></tr>");
                return;
            }

            transactions.forEach(t => {
                tbody.append(`
                    <tr>
                        <td>${formatDateShort(t.transaction_date)}</td>
                        <td>${t.from_username || ''}</td>
                        <td>${t.to_username || ''}</td>
                        <td>${(t.amount ?? 0).toFixed(2)}</td>
                        <td>${t.currency || ''}</td>
                        <td>${(t.from_balance ?? 0).toFixed(2)}</td>
                        <td>${(t.to_balance ?? 0).toFixed(2)}</td>
                    </tr>
                `);
            });

        } catch (err) {
            console.error(err);
            tbody.html("<tr><td colspan='7' class='text-danger'>Error loading transactions</td></tr>");
        }
    }

    function downloadTransactionPDF(user, entity) {
        const url = `/download_transactions_pdf?username=${encodeURIComponent(user.username)}&entity=${entity || ''}`;
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.download = "transactions_report.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    // -----------------------------
    // UTILS
    // -----------------------------
    function formatDateLong(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (isNaN(d)) return "";
        return d.toLocaleDateString("fr-FR");
    }

    function formatDateShort(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (isNaN(d)) return "";
        return d.toLocaleDateString("fr-FR");
    }

    function printTab(tabId) {
        const content = document.getElementById(tabId).innerHTML;
        const win = window.open('', '', 'width=800,height=600');
        win.document.write(content);
        win.print();
        win.close();
    }

    function cancelTab(tabId) {
        document.getElementById(tabId).querySelectorAll('input, textarea').forEach(el => el.value = '');
    }

    // -----------------------------
    // TAB NAVIGATION
    // -----------------------------
    $(document).off("click", ".tab-link").on("click", ".tab-link", function () {
        const target = $(this).data("target");
        const user = User.getCurrentUser();
        if (!user) return console.warn("No current user found");

        $(".tab-pane").removeClass("active");
        $("#" + target).addClass("active");
        $(this).siblings().removeClass("active");
        $(this).addClass("active");

        switch (target) {
            case "invoice":
                loadInvoiceTab(user, window._currentEntity);
                break;
            case "report":
                loadReportTab(user, window._currentEntity);
                break;
            case "email":
                fillEmailTab(user, window._currentEntity);
                break;
            case "transactions":
                loadTransactionsTab(user, window._currentEntity);
                break;
        }
    });

});
 




 
