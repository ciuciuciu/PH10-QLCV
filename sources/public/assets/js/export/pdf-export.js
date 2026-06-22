(function initDashboardPdfExport(globalScope) {
    const PALETTE = {
        navy: "#183B66",
        navySoft: "#EEF4FB",
        navyLine: "#C8D7EA",
        slate: "#5B6B80",
        text: "#1F2937",
        muted: "#667085",
        zebra: "#F8FAFC",
        total: "#D8E4F2",
        green: "#1F7A4F",
        greenSoft: "#EAF7F0",
        amber: "#A15C00",
        amberSoft: "#FFF4DE",
        red: "#B42318",
        redSoft: "#FEECEB"
    };

    function createSectionHeading(text) {
        return {
            table: {
                widths: ["*"],
                body: [[
                    {
                        text,
                        style: "sectionHeadingCell"
                    }
                ]]
            },
            layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 12,
                paddingRight: () => 12,
                paddingTop: () => 7,
                paddingBottom: () => 7
            },
            margin: [0, 0, 0, 10]
        };
    }

    function createMetricCard(label, value, accent, softTone) {
        return {
            width: 188,
            stack: [
                {
                    canvas: [
                        {
                            type: "rect",
                            x: 0,
                            y: 0,
                            w: 188,
                            h: 78,
                            r: 16,
                            color: softTone,
                            lineColor: accent,
                            lineWidth: 1.4
                        }
                    ]
                },
                {
                    text: label,
                    style: "metricLabel",
                    color: accent,
                    margin: [14, -60, 14, 0]
                },
                {
                    text: String(value),
                    style: "metricValue",
                    color: PALETTE.navy,
                    margin: [14, 8, 14, 0]
                }
            ]
        };
    }

    function createNoteBox(text) {
        return {
            text,
            style: "noteTextInline",
            margin: [0, 10, 0, 0]
        };
    }

    function buildSummaryCell(text, options = {}) {
        return {
            text,
            alignment: options.alignment || "left",
            bold: Boolean(options.bold),
            color: options.color || PALETTE.text,
            fillColor: options.fillColor,
            margin: [0, 2, 0, 2]
        };
    }

    function buildDetailCell(content, options = {}) {
        return {
            ...(typeof content === "string" ? { text: content } : content),
            alignment: options.alignment || "left",
            fillColor: options.fillColor,
            color: options.color || PALETTE.text,
            bold: Boolean(options.bold),
            margin: [0, 2, 0, 2]
        };
    }

    function createSummaryTableBody(context) {
        const {
            reportModel,
            formatKpiAScore
        } = context;

        const headerRow = [
            { text: "STT", style: "tableHeader", alignment: "center" },
            { text: "Đơn vị trực thuộc", style: "tableHeader", alignment: "center" },
            { text: "Tổng số nhiệm vụ", style: "tableHeader", alignment: "center" },
            { text: "Đã hoàn thành", style: "tableHeader", alignment: "center" },
            { text: "Đang triển khai", style: "tableHeader", alignment: "center" },
            { text: "Chậm tiến độ", style: "tableHeader", alignment: "center" },
            { text: "Tỷ lệ hoàn thành (%)", style: "tableHeader", alignment: "center" },
            { text: "KPI-A", style: "tableHeader", alignment: "center" },
            { text: "KPI-B", style: "tableHeader", alignment: "center" },
            { text: "KPI-C", style: "tableHeader", alignment: "center" },
            { text: "KPI", style: "tableHeader", alignment: "center" }
        ];

        const dataRows = reportModel.summaryRows.length
            ? reportModel.summaryRows.map((unit, index) => {
                const rowFill = index % 2 === 0 ? "#FFFFFF" : PALETTE.zebra;
                return [
                    buildSummaryCell(String(unit.order), { alignment: "center", bold: true, fillColor: rowFill }),
                    buildSummaryCell(unit.unit_name || "-", { bold: true, fillColor: rowFill }),
                    buildSummaryCell(String(unit.assigned_count), { alignment: "center", fillColor: rowFill }),
                    buildSummaryCell(String(unit.done_count), { alignment: "center", fillColor: rowFill, color: PALETTE.green, bold: true }),
                    buildSummaryCell(String(unit.pending_count), { alignment: "center", fillColor: rowFill, color: PALETTE.amber, bold: true }),
                    buildSummaryCell(String(unit.delayed_count), { alignment: "center", fillColor: rowFill, color: PALETTE.red, bold: true }),
                    buildSummaryCell(`${unit.kpi_a_percent}%`, { alignment: "center", fillColor: PALETTE.navySoft, bold: true }),
                    buildSummaryCell(formatKpiAScore(unit.kpi_a_score), { alignment: "center", fillColor: rowFill }),
                    buildSummaryCell(formatKpiAScore(unit.kpi_b_score), { alignment: "center", fillColor: rowFill }),
                    buildSummaryCell(formatKpiAScore(unit.kpi_c_score), { alignment: "center", fillColor: rowFill }),
                    buildSummaryCell(`${formatKpiAScore(unit.final_kpi_score)}%`, { alignment: "center", fillColor: PALETTE.navySoft, color: PALETTE.navy, bold: true })
                ];
            })
            : [[{ text: "Chưa có dữ liệu tổng hợp phù hợp với bộ lọc hiện tại.", colSpan: 11, italics: true, alignment: "center", color: "#64748b" }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}]];

        const totalRow = [
            { text: "TỔNG CỘNG TOÀN PHÒNG", colSpan: 2, style: "totalCell", alignment: "center" },
            {},
            { text: String(reportModel.totals.assigned_count), style: "totalCell", alignment: "center" },
            { text: String(reportModel.totals.done_count), style: "totalCell", alignment: "center", color: PALETTE.green },
            { text: String(reportModel.totals.pending_count), style: "totalCell", alignment: "center", color: PALETTE.amber },
            { text: String(reportModel.totals.delayed_count), style: "totalCell", alignment: "center", color: PALETTE.red },
            { text: `${reportModel.totals.kpi_a_percent}%`, style: "totalCellEmphasis", alignment: "center" },
            { text: formatKpiAScore(reportModel.totals.kpi_a_score), style: "totalCell", alignment: "center" },
            { text: formatKpiAScore(reportModel.totals.kpi_b_score), style: "totalCell", alignment: "center" },
            { text: formatKpiAScore(reportModel.totals.kpi_c_score), style: "totalCell", alignment: "center" },
            { text: `${formatKpiAScore(reportModel.totals.final_kpi_score)}%`, style: "totalCellEmphasis", alignment: "center" }
        ];

        return [headerRow, ...dataRows, totalRow];
    }

    function createDetailTableBody(context) {
        const {
            reportModel,
            formatDate,
            displayStatusName,
            getCountdownTemplate
        } = context;

        const headerRow = [
            { text: "STT", style: "tableHeader", alignment: "center" },
            { text: "1. Lãnh đạo giao", style: "tableHeader", alignment: "center" },
            { text: "2. Rõ việc", style: "tableHeader", alignment: "center" },
            { text: "3. Rõ người (Đơn vị)", style: "tableHeader", alignment: "center" },
            { text: "4. Rõ tiến độ & đếm ngược", style: "tableHeader", alignment: "center" },
            { text: "5. Rõ kết quả đầu ra", style: "tableHeader", alignment: "center" },
            { text: "6. Rõ trách nhiệm", style: "tableHeader", alignment: "center" },
            { text: "7. Rõ thẩm quyền", style: "tableHeader", alignment: "center" },
            { text: "Cập nhật kết quả thực tế", style: "tableHeader", alignment: "center" },
            { text: "Ghi chú", style: "tableHeader", alignment: "center" }
        ];

        const dataRows = reportModel.filteredTasks.length
            ? reportModel.filteredTasks.map((task, index) => {
                const statusLabel = displayStatusName(task);
                const statusColor = task.status_code === "done"
                    ? "#166534"
                    : task.status_code === "delayed" || task.is_overdue
                        ? "#991b1b"
                        : "#92400e";
                const statusFill = task.status_code === "done"
                    ? PALETTE.greenSoft
                    : task.status_code === "delayed" || task.is_overdue
                        ? PALETTE.redSoft
                        : PALETTE.amberSoft;
                const rowFill = index % 2 === 0 ? "#FFFFFF" : PALETTE.zebra;

                return [
                    buildDetailCell(String(index + 1).padStart(2, "0"), { alignment: "center", bold: true, fillColor: rowFill }),
                    buildDetailCell(task.assigner_name || "-", { fillColor: rowFill, bold: true }),
                    buildDetailCell(task.title || "-", { fillColor: rowFill }),
                    buildDetailCell(task.unit_name || "-", { fillColor: rowFill }),
                    buildDetailCell({
                        stack: [
                            { text: `Hạn: ${formatDate(task.due_date)}`, bold: true, color: PALETTE.navy },
                            { text: statusLabel, color: statusColor, bold: true, margin: [0, 4, 0, 0] },
                            { text: getCountdownTemplate(task), color: PALETTE.muted, fontSize: 8, margin: [0, 3, 0, 0] }
                        ]
                    }, { fillColor: statusFill }),
                    buildDetailCell(task.expected_result || "-", { fillColor: rowFill }),
                    buildDetailCell(task.owner_name || "-", { fillColor: rowFill, bold: true }),
                    buildDetailCell(task.authority_name || "-", { fillColor: rowFill }),
                    buildDetailCell(task.latest_update || "-", { fillColor: rowFill, color: PALETTE.navy }),
                    buildDetailCell(task.latest_issue || "-", { fillColor: rowFill, color: PALETTE.slate })
                ];
            })
            : [[{ text: "Chưa có công việc phù hợp với bộ lọc hiện tại.", colSpan: 10, italics: true, alignment: "center", color: "#64748b" }, {}, {}, {}, {}, {}, {}, {}, {}, {}]];

        return [headerRow, ...dataRows];
    }

    function buildDocumentDefinition(context) {
        const { reportModel } = context;

        return {
            pageSize: "A4",
            pageOrientation: "landscape",
            pageMargins: [24, 24, 24, 24],
            info: {
                title: "Báo cáo dashboard 6 rõ",
                author: "PH10",
                subject: "Báo cáo dashboard",
                keywords: "dashboard, pdf, 6 rõ"
            },
            defaultStyle: {
                font: "Roboto",
                fontSize: 8.5,
                lineHeight: 1.2,
                color: PALETTE.text
            },
            content: [
                {
                    canvas: [
                        {
                            type: "rect",
                            x: 0,
                            y: 0,
                            w: 794,
                            h: 64,
                            r: 10,
                            color: PALETTE.navySoft,
                            lineColor: PALETTE.navyLine
                        }
                    ]
                },
                { text: 'Báo cáo dashboard theo dõi tiến độ công việc "6 rõ"', style: "reportTitle", alignment: "center", margin: [0, -52, 0, 4] },
                { text: `Phạm vi dữ liệu: ${reportModel.meta.monthLabel} | ${reportModel.meta.assignerLabel} | ${reportModel.meta.unitLabel} | Ngày lập báo cáo: ${reportModel.meta.generatedDateLabel}`, style: "reportSubtitle", alignment: "center", margin: [0, 0, 0, 16] },
                createSectionHeading("1. Thống kê công việc"),
                {
                    columns: [
                        createMetricCard("Tổng số công việc", reportModel.totals.assigned_count, PALETTE.navy, PALETTE.navySoft),
                        createMetricCard("Đã hoàn thành", reportModel.totals.done_count, PALETTE.green, PALETTE.greenSoft),
                        createMetricCard("Đang triển khai", reportModel.totals.pending_count, PALETTE.amber, PALETTE.amberSoft),
                        createMetricCard("Chậm tiến độ", reportModel.totals.delayed_count, PALETTE.red, PALETTE.redSoft)
                    ],
                    columnGap: 10,
                    margin: [0, 0, 0, 16]
                },
                {
                    ...createSectionHeading("2. Bảng tổng hợp tiến độ & hiệu suất theo từng đội"),
                    margin: [0, 8, 0, 10]
                },
                {
                    table: {
                        headerRows: 1,
                        widths: [24, "*", 54, 54, 58, 54, 62, 44, 44, 44, 52],
                        body: createSummaryTableBody(context)
                    },
                    layout: {
                        hLineWidth: (index, node) => (index === 0 || index === 1 || index === node.table.body.length ? 0 : 0.7),
                        vLineWidth: () => 0,
                        hLineColor: () => PALETTE.navyLine,
                        paddingLeft: () => 8,
                        paddingRight: () => 8,
                        paddingTop: () => 6,
                        paddingBottom: () => 6
                    }
                },
                createNoteBox('Lưu ý: "Chậm tiến độ" là công việc đã hoàn thành nhưng hoàn thành sau hạn. Công việc chưa hoàn thành nhưng đã quá hạn vẫn thuộc trạng thái "Đang triển khai" và được cảnh báo bằng bộ đếm ngược.'),
                {
                    ...createSectionHeading('3. Bảng chi tiết theo dõi tiến độ công việc "6 rõ"'),
                    margin: [0, 18, 0, 10]
                },
                {
                    table: {
                        headerRows: 1,
                        widths: [22, 58, "*", 66, 92, 86, 66, 64, 98, 74],
                        body: createDetailTableBody(context)
                    },
                    layout: {
                        hLineWidth: (index, node) => (index === 0 || index === 1 || index === node.table.body.length ? 0 : 0.6),
                        vLineWidth: () => 0,
                        hLineColor: () => PALETTE.navyLine,
                        paddingLeft: () => 7,
                        paddingRight: () => 7,
                        paddingTop: () => 6,
                        paddingBottom: () => 6
                    }
                }
            ],
            styles: {
                reportTitle: {
                    fontSize: 18,
                    bold: true,
                    color: PALETTE.navy,
                    margin: [0, 0, 0, 6]
                },
                reportSubtitle: {
                    fontSize: 9,
                    color: PALETTE.slate
                },
                sectionHeadingCell: {
                    fontSize: 11,
                    bold: true,
                    color: PALETTE.navy,
                    fillColor: PALETTE.navySoft
                },
                metricLabel: {
                    fontSize: 8.5,
                    bold: true,
                    margin: [0, 0, 0, 0]
                },
                metricValue: {
                    fontSize: 20,
                    bold: true,
                    margin: [0, 3, 0, 0]
                },
                tableHeader: {
                    fillColor: PALETTE.navy,
                    color: "#ffffff",
                    bold: true,
                    fontSize: 8.2,
                    margin: [0, 4, 0, 4]
                },
                totalCell: {
                    fillColor: PALETTE.total,
                    bold: true,
                    color: PALETTE.navy,
                    margin: [0, 4, 0, 4]
                },
                totalCellEmphasis: {
                    fillColor: PALETTE.navySoft,
                    bold: true,
                    color: PALETTE.navy,
                    margin: [0, 4, 0, 4]
                },
                noteTextInline: {
                    fontSize: 8,
                    color: PALETTE.slate,
                    italics: true
                }
            }
        };
    }

    function exportReport(context) {
        if (!globalScope.pdfMake?.createPdf) {
            if (typeof App !== "undefined" && App.showMessage) {
                App.showMessage("Chưa tải được bộ thư viện PDF.", "error");
            }
            return;
        }

        const documentDefinition = buildDocumentDefinition(context);
        const fileName = `Bao_cao_dashboard_6_ro_${context.reportModel.meta.monthValue}.pdf`;
        globalScope.pdfMake.createPdf(documentDefinition).download(fileName);
    }

    globalScope.DashboardPdfExport = {
        exportReport
    };
})(window);
