(function initDashboardExcelExport(globalScope) {
    function exportReport(context) {
        const {
            reportModel,
            formatKpiAScore,
            formatDate,
            displayStatusName,
            getCountdownTemplate,
            escapeReportHtml,
            buildExportFileBaseName
        } = context;

        const summaryRows = reportModel.summaryRows.map((unit) => `
                <tr class="data-row">
                    <td class="text-center">${unit.order}</td>
                    <td class="text-left font-bold">${escapeReportHtml(unit.unit_name)}</td>
                    <td class="text-center font-bold">${unit.assigned_count}</td>
                    <td class="text-center font-bold text-success">${unit.done_count}</td>
                    <td class="text-center font-bold text-warning">${unit.pending_count}</td>
                    <td class="text-center font-bold text-danger">${unit.delayed_count}</td>
                    <td class="text-center font-bold highlight-cell">${unit.kpi_a_percent}%</td>
                    <td class="text-center font-bold highlight-cell">${formatKpiAScore(unit.kpi_a_score)}</td>
                    <td class="text-center font-bold highlight-cell">${formatKpiAScore(unit.kpi_b_score)}</td>
                    <td class="text-center font-bold highlight-cell">${formatKpiAScore(unit.kpi_c_score)}</td>
                    <td class="text-center font-bold highlight-cell">${formatKpiAScore(unit.final_kpi_score)}%</td>
                </tr>
            `).join("") || `
                <tr class="data-row">
                    <td colspan="11" class="text-center">Chưa có dữ liệu tổng hợp phù hợp với bộ lọc hiện tại.</td>
                </tr>
            `;

        const summaryTotalRow = `
            <tr class="total-row">
                <td colspan="2" class="text-center font-bold">TỔNG CỘNG TOÀN PHÒNG</td>
                <td class="text-center font-bold">${reportModel.totals.assigned_count}</td>
                <td class="text-center font-bold text-success">${reportModel.totals.done_count}</td>
                <td class="text-center font-bold text-warning">${reportModel.totals.pending_count}</td>
                <td class="text-center font-bold text-danger">${reportModel.totals.delayed_count}</td>
                <td class="text-center font-bold highlight-total">${reportModel.totals.kpi_a_percent}%</td>
                <td class="text-center font-bold highlight-total">${formatKpiAScore(reportModel.totals.kpi_a_score)}</td>
                <td class="text-center font-bold highlight-total">${formatKpiAScore(reportModel.totals.kpi_b_score)}</td>
                <td class="text-center font-bold highlight-total">${formatKpiAScore(reportModel.totals.kpi_c_score)}</td>
                <td class="text-center font-bold highlight-total">${formatKpiAScore(reportModel.totals.final_kpi_score)}%</td>
            </tr>
        `;

        const detailRows = reportModel.filteredTasks.map((task, index) => {
            const currentStatus = displayStatusName(task);
            const statusColorClass = task.status_code === "done"
                ? "text-success"
                : task.status_code === "delayed"
                    ? "text-danger"
                    : task.is_overdue
                        ? "text-danger"
                        : "text-warning";

            return `
                <tr class="data-row">
                    <td class="text-center">${String(index + 1).padStart(2, "0")}</td>
                    <td class="text-left font-bold text-darkorange">${escapeReportHtml(task.assigner_name)}</td>
                    <td class="text-left font-bold">${escapeReportHtml(task.title)}</td>
                    <td class="text-center"><span class="badge-unit">${escapeReportHtml(task.unit_name)}</span></td>
                    <td class="text-center font-bold">Hạn: ${escapeReportHtml(formatDate(task.due_date))}<br/><span class="${statusColorClass}">${escapeReportHtml(currentStatus)}</span><br/><small style="color:#718096;">${escapeReportHtml(getCountdownTemplate(task))}</small></td>
                    <td class="text-left">${escapeReportHtml(task.expected_result)}</td>
                    <td class="text-left font-bold">${escapeReportHtml(task.owner_name)}</td>
                    <td class="text-left"><small>${escapeReportHtml(task.authority_name)}</small></td>
                    <td class="text-left font-bold text-link">${escapeReportHtml(task.latest_update)}</td>
                    <td class="text-left text-italic">${escapeReportHtml(task.latest_issue)}</td>
                </tr>
            `;
        }).join("") || `
            <tr class="data-row">
                <td colspan="10" class="text-center">Chưa có công việc phù hợp với bộ lọc hiện tại.</td>
            </tr>
        `;

        const excelTemplate = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8"/>
                <style>
                    body { font-family: "Segoe UI", "Arial", sans-serif; color: #2d3748; }
                    table { border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; width: 100%; }
                    th, td { border: 1px solid #a0aec0 !important; padding: 8px 10px; vertical-align: middle; mso-number-format:"\\@"; white-space: normal; word-wrap: break-word; }
                    .main-title { font-size: 18pt; font-weight: bold; color: #1a365d; text-align: center; font-family: "Segoe UI", Arial; text-transform: uppercase; }
                    .sub-title { font-size: 11pt; font-style: italic; color: #4a5568; text-align: center; }
                    .section-heading { font-size: 13pt; font-weight: bold; color: #1a365d; font-family: "Segoe UI", Arial; margin-top: 20px; margin-bottom: 8px; }
                    th { background-color: #1a365d !important; color: #ffffff !important; font-size: 10.5pt; font-weight: bold; text-align: center; text-transform: uppercase; height: 32px; }
                    .data-row { height: 26px; font-size: 11pt; }
                    .total-row { background-color: #cbd5e0 !important; font-size: 11pt; font-weight: bold; height: 30px; }
                    .text-center { text-align: center; }
                    .text-left { text-align: left; }
                    .font-bold { font-weight: bold; }
                    .text-italic { font-style: italic; color: #4a5568; }
                    .text-success { color: #22543d !important; font-weight: bold; }
                    .text-warning { color: #b7791f !important; font-weight: bold; }
                    .text-danger { color: #9b2c2c !important; font-weight: bold; }
                    .text-darkorange { color: #c05621 !important; }
                    .text-link { color: #2b6cb0 !important; }
                    .highlight-cell { background-color: #edf2f7 !important; color: #1a365d !important; }
                    .highlight-total { background-color: #a0aec0 !important; color: #1a365d !important; }
                    .badge-unit { background-color: #ebf8ff !important; color: #1a365d !important; padding: 2px 4px; border-radius: 4px; font-weight: bold; }
                    .completion-cell { line-height: 1.35; }
                    .completion-total { font-size: 11pt; font-weight: bold; }
                    .completion-breakdown { font-size: 9pt; font-weight: 600; }
                </style>
            </head>
            <body>
                <table>
                    <tr><td colspan="12" style="border:none !important;" class="main-title">BÁO CÁO DASHBOARD THEO DÕI TIẾN ĐỘ CÔNG VIỆC "6 RÕ"</td></tr>
                    <tr><td colspan="12" style="border:none !important;" class="sub-title">Phạm vi dữ liệu: ${escapeReportHtml(reportModel.meta.monthLabel)} | ${escapeReportHtml(reportModel.meta.assignerLabel)} | ${escapeReportHtml(reportModel.meta.unitLabel)} | Ngày lập báo cáo trực tuyến: ${escapeReportHtml(reportModel.meta.generatedDateLabel)}</td></tr>
                </table>
                <div class="section-heading">I. BẢNG TỔNG HỢP TIẾN ĐỘ & HIỆU SUẤT CÁC ĐỘI NGHIỆP VỤ</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 45px;">STT</th>
                            <th style="width: 250px;">Đơn vị trực thuộc</th>
                            <th style="width: 120px;">Tổng số nhiệm vụ</th>
                            <th style="width: 180px;">Đã hoàn thành</th>
                            <th style="width: 120px;">Đang triển khai</th>
                            <th style="width: 120px;">Chậm tiến độ</th>
                            <th style="width: 150px;">Tỷ lệ hoàn thành</th>
                            <th style="width: 110px;">KPI-A</th>
                            <th style="width: 110px;">KPI-B</th>
                            <th style="width: 110px;">KPI-C</th>
                            <th style="width: 110px;">KPI</th>
                        </tr>
                    </thead>
                    <tbody>${summaryRows}${summaryTotalRow}</tbody>
                </table>
                <br/>
                <div style="font-size:10pt; color:#4a5568; margin-bottom:10px;">
                    <strong>Lưu ý:</strong> "Chậm tiến độ" là công việc đã hoàn thành nhưng hoàn thành sau hạn. Công việc chưa hoàn thành nhưng đã quá hạn vẫn thuộc trạng thái "Đang triển khai" và được cảnh báo bằng bộ đếm ngược.
                </div>
                <div class="section-heading">II. BẢNG CHI TIẾT THEO DÕI TIẾN ĐỘ CÔNG VIỆC CỤ THỂ KHỐI HẬU CẦN</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 45px;">STT</th>
                            <th style="width: 140px;">1. LÃNH ĐẠO GIAO</th>
                            <th style="width: 260px;">2. RÕ VIỆC (Nội dung)</th>
                            <th style="width: 140px;">3. RÕ NGƯỜI (Đơn vị)</th>
                            <th style="width: 160px;">4. TIẾN ĐỘ & TRẠNG THÁI</th>
                            <th style="width: 220px;">5. RÕ KẾT QUẢ ĐẦU RA</th>
                            <th style="width: 140px;">6. RÕ TRÁCH NHIỆM</th>
                            <th style="width: 130px;">7. RÕ THẨM QUYỀN</th>
                            <th style="width: 240px;">CẬP NHẬT KẾT QUẢ THỰC TẾ</th>
                            <th style="width: 180px;">GHI CHÚ / KHÓ KHĂN</th>
                        </tr>
                    </thead>
                    <tbody>${detailRows}</tbody>
                </table>
            </body>
            </html>
        `;

        const blobData = new Blob(["\uFEFF" + excelTemplate], { type: "application/vnd.ms-excel;charset=utf-8" });
        const url = window.URL.createObjectURL(blobData);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${buildExportFileBaseName(reportModel)}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }

    globalScope.DashboardExcelExport = {
        exportReport
    };
})(window);
