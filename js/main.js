// Лабораторная работа №1: загрузка CSV и визуализация данных с помощью D3.js

const DATA_URL = "data/bitcoin_monthly.csv";

// Описание числовых показателей: подпись, единицы измерения и формат вывода
const METRICS = {
  price_usd:            { label: "Средняя цена BTC",           unit: "USD",          format: d3.format("$,.0f") },
  transactions_per_day: { label: "Транзакций в сутки",          unit: "шт.",          format: d3.format(",.0f") },
  hash_rate_ehs:        { label: "Хешрейт сети",               unit: "EH/s",         format: d3.format(",.0f") },
  avg_block_size_mb:    { label: "Средний размер блока",       unit: "МБ",           format: d3.format(".2f") },
  fees_usd_per_day:     { label: "Комиссии майнерам в сутки",  unit: "USD",          format: d3.format("$,.0f") }
};

// Халвинги Bitcoin в выбранном периоде — отмечаются на линейном графике
const EVENTS = [
  { date: new Date(2020, 4, 11), label: "Халвинг 2020" },
  { date: new Date(2024, 3, 20), label: "Халвинг 2024" }
];

const parseMonth = d3.timeParse("%Y-%m");
const formatMonth = d3.timeFormat("%m.%Y");

const state = { data: [], metric: "price_usd", yearFrom: null, yearTo: null };
const tooltip = d3.select("#tooltip");

// ---------- 1. Загрузка и обработка данных ----------

// Функция преобразования строки CSV: все значения в CSV — строки,
// поэтому числовые столбцы приводим к Number, а месяц — к Date
function convertRow(d) {
  return {
    month: parseMonth(d.month),
    price_usd: +d.price_usd,
    transactions_per_day: +d.transactions_per_day,
    hash_rate_ehs: +d.hash_rate_ehs,
    avg_block_size_mb: +d.avg_block_size_mb,
    fees_usd_per_day: +d.fees_usd_per_day
  };
}

d3.csv(DATA_URL, convertRow)
  .then(data => {
    // Отбрасываем строки с некорректной датой или нечисловыми значениями
    const valid = data.filter(d => d.month && Object.keys(METRICS).every(k => Number.isFinite(d[k])));
    if (valid.length === 0) {
      throw new Error("Файл загружен, но не содержит корректных записей.");
    }
    valid.columns = data.columns;
    state.data = valid;

    showDataInfo(valid, data.length - valid.length);
    setupControls(valid);
    renderAll();
    window.addEventListener("resize", debounce(renderAll, 150));
  })
  .catch(error => {
    // Ошибка сети, отсутствующий файл или некорректные данные
    console.error(error);
    const hint = location.protocol === "file:"
      ? "<br>Страница открыта как локальный файл (file://). Браузер блокирует загрузку CSV — запустите локальный сервер (см. README.md)."
      : "";
    d3.select("#status")
      .attr("class", "status status--error")
      .html(`Не удалось загрузить <code>${DATA_URL}</code>: ${error.message}${hint}`);
  });

function showDataInfo(data, skipped) {
  const columns = data.columns;
  const status = `CSV-файл успешно загружен и обработан.` +
    (skipped > 0 ? ` Пропущено некорректных строк: ${skipped}.` : "");
  d3.select("#status").attr("class", "status status--ok").text(status);

  d3.select("#info-grid").attr("hidden", null);
  d3.select("#file-name").text(DATA_URL.split("/").pop());
  d3.select("#row-count").text(data.length);
  d3.select("#col-count").text(columns.length);
  const [min, max] = d3.extent(data, d => d.month);
  d3.select("#period").text(`${formatMonth(min)} — ${formatMonth(max)}`);

  d3.select("#columns-block").attr("hidden", null);
  d3.select("#columns")
    .selectAll("li")
    .data(columns)
    .join("li")
    .html(c => `${c} <span>${typeof data[0][c] === "number" ? "number" : "date"}</span>`);

  // Таблица первых 10 записей — видно, что значения уже числа
  const table = d3.select("#preview-table");
  table.append("thead").append("tr")
    .selectAll("th").data(columns).join("th").text(c => c);
  table.append("tbody")
    .selectAll("tr").data(data.slice(0, 10)).join("tr")
    .selectAll("td")
    .data(row => columns.map(c => c === "month" ? formatMonth(row.month) : row[c].toLocaleString("ru-RU")))
    .join("td").text(v => v);
  d3.select("#table-card").attr("hidden", null);
}

// ---------- 2. Интерактивность: выбор показателя и фильтр по годам ----------

function setupControls(data) {
  const years = Array.from(new Set(data.map(d => d.month.getFullYear()))).sort();
  state.yearFrom = years[0];
  state.yearTo = years[years.length - 1];

  d3.select("#metric-select")
    .selectAll("option")
    .data(Object.entries(METRICS))
    .join("option")
    .attr("value", ([key]) => key)
    .text(([, m]) => `${m.label}, ${m.unit}`);

  d3.select("#year-from").selectAll("option").data(years).join("option").attr("value", y => y).text(y => y);
  d3.select("#year-to").selectAll("option").data(years).join("option").attr("value", y => y).text(y => y);
  d3.select("#year-from").property("value", state.yearFrom);
  d3.select("#year-to").property("value", state.yearTo);

  d3.select("#metric-select").on("change", event => {
    state.metric = event.target.value;
    renderAll();
  });
  d3.select("#year-from").on("change", event => {
    state.yearFrom = +event.target.value;
    if (state.yearFrom > state.yearTo) {
      state.yearTo = state.yearFrom;
      d3.select("#year-to").property("value", state.yearTo);
    }
    renderAll();
  });
  d3.select("#year-to").on("change", event => {
    state.yearTo = +event.target.value;
    if (state.yearTo < state.yearFrom) {
      state.yearFrom = state.yearTo;
      d3.select("#year-from").property("value", state.yearFrom);
    }
    renderAll();
  });

  d3.selectAll("#controls, #bar-card, #line-card").attr("hidden", null);
}

function filteredData() {
  return state.data.filter(d => {
    const y = d.month.getFullYear();
    return y >= state.yearFrom && y <= state.yearTo;
  });
}

function renderAll() {
  const data = filteredData();
  const m = METRICS[state.metric];
  const range = state.yearFrom === state.yearTo ? `${state.yearFrom}` : `${state.yearFrom}–${state.yearTo}`;

  d3.select("#bar-title").text(`${m.label} по годам (${range})`);
  d3.select("#bar-desc").text(
    `Каждый столбец — среднее значение показателя «${m.label}» за календарный год. ` +
    `Диаграмма позволяет сравнить годы между собой.`
  );
  d3.select("#line-title").text(`${m.label} по месяцам (${range})`);
  d3.select("#line-desc").text(
    `Линия показывает помесячную динамику показателя «${m.label}». ` +
    `Пунктиром отмечены халвинги — уменьшение награды за блок вдвое.`
  );

  drawBarChart(data, m);
  drawLineChart(data, m);
}

// ---------- 3. Визуализация 1: столбчатая диаграмма ----------

function drawBarChart(data, metric) {
  const container = d3.select("#bar-chart");
  container.selectAll("*").remove();

  // Группируем месяцы по годам и считаем среднее значение показателя
  const byYear = d3.rollups(
    data,
    rows => ({ value: d3.mean(rows, d => d[state.metric]), months: rows.length }),
    d => d.month.getFullYear()
  ).map(([year, v]) => ({ year, ...v })).sort((a, b) => a.year - b.year);

  // Ширина берётся из контейнера; минимум 320px на случай, если он ещё не отрисован
  const width = Math.max(container.node().clientWidth, 320);
  const height = 360;
  const margin = { top: 24, right: 16, bottom: 48, left: 76 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", `Столбчатая диаграмма: ${metric.label} по годам`);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(byYear.map(d => d.year))
    .range([0, innerW])
    .padding(0.3);
  const y = d3.scaleLinear()
    .domain([0, d3.max(byYear, d => d.value)])
    .nice()
    .range([innerH, 0]);

  // Сетка и оси
  g.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(""));
  g.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickSizeOuter(0));
  g.append("g").attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")));

  // Подписи осей
  g.append("text").attr("class", "axis-label")
    .attr("x", innerW / 2).attr("y", innerH + 40)
    .attr("text-anchor", "middle")
    .text("Год");
  g.append("text").attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2).attr("y", -58)
    .attr("text-anchor", "middle")
    .text(`${metric.label}, ${metric.unit}`);

  // Столбцы: верхние углы скруглены, нижние стоят на базовой линии
  const bars = g.append("g").attr("class", "bars");
  bars.selectAll("path.bar")
    .data(byYear)
    .join("path")
    .attr("class", "bar")
    .attr("d", d => roundedTopBar(x(d.year), y(d.value), x.bandwidth(), innerH - y(d.value), 4));

  // Подписи значений над столбцами
  bars.selectAll("text.bar-label")
    .data(byYear)
    .join("text")
    .attr("class", "bar-label")
    .attr("x", d => x(d.year) + x.bandwidth() / 2)
    .attr("y", d => y(d.value) - 6)
    .attr("text-anchor", "middle")
    .text(d => d3.format(".3~s")(d.value));

  // Невидимые прямоугольники на всю высоту — увеличенная зона наведения
  bars.selectAll("rect.bar-hit")
    .data(byYear)
    .join("rect")
    .attr("class", "bar-hit")
    .attr("x", d => x(d.year) - (x.step() - x.bandwidth()) / 2)
    .attr("width", x.step())
    .attr("y", 0)
    .attr("height", innerH)
    .on("mousemove", (event, d) => {
      bars.classed("is-hovering", true);
      bars.selectAll("path.bar").classed("is-active", b => b.year === d.year);
      showTooltip(event,
        `<strong>${d.year} год</strong>` +
        `${metric.label}: ${metric.format(d.value)} ${metric.unit === "USD" ? "" : metric.unit}<br>` +
        `<span class="muted">Среднее по ${d.months} мес.</span>`);
    })
    .on("mouseleave", () => {
      bars.classed("is-hovering", false);
      bars.selectAll("path.bar").classed("is-active", false);
      hideTooltip();
    });
}

function roundedTopBar(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

// ---------- 4. Визуализация 2: линейный график ----------

function drawLineChart(data, metric) {
  const container = d3.select("#line-chart");
  container.selectAll("*").remove();

  const width = Math.max(container.node().clientWidth, 320);
  const height = 360;
  const margin = { top: 24, right: 16, bottom: 48, left: 76 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const key = state.metric;

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", `Линейный график: ${metric.label} по месяцам`);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
    .domain(d3.extent(data, d => d.month))
    .range([0, innerW]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d[key])])
    .nice()
    .range([innerH, 0]);

  g.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(""));
  g.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(innerW / 90))).tickFormat(d3.timeFormat("%m.%Y")).tickSizeOuter(0));
  g.append("g").attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")));

  g.append("text").attr("class", "axis-label")
    .attr("x", innerW / 2).attr("y", innerH + 40)
    .attr("text-anchor", "middle")
    .text("Месяц");
  g.append("text").attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2).attr("y", -58)
    .attr("text-anchor", "middle")
    .text(`${metric.label}, ${metric.unit}`);

  // Для одного месяца линию построить нельзя — показываем только точку
  if (data.length < 2) {
    g.append("text").attr("class", "empty")
      .attr("x", innerW / 2).attr("y", innerH / 2).attr("text-anchor", "middle")
      .text("Недостаточно точек для построения линии");
    return;
  }

  // Отметки халвингов, попадающих в выбранный период
  const [start, end] = x.domain();
  const events = EVENTS.filter(e => e.date >= start && e.date <= end);
  const annot = g.append("g");
  annot.selectAll("line").data(events).join("line")
    .attr("class", "annot-line")
    .attr("x1", e => x(e.date)).attr("x2", e => x(e.date))
    .attr("y1", 0).attr("y2", innerH);
  annot.selectAll("text").data(events).join("text")
    .attr("class", "annot-text")
    .attr("x", e => x(e.date) + 4).attr("y", 10)
    .text(e => e.label);

  // Область под линией и сама линия
  g.append("path").datum(data)
    .attr("class", "area")
    .attr("d", d3.area().x(d => x(d.month)).y0(innerH).y1(d => y(d[key])).curve(d3.curveMonotoneX));
  g.append("path").datum(data)
    .attr("class", "line")
    .attr("d", d3.line().x(d => x(d.month)).y(d => y(d[key])).curve(d3.curveMonotoneX));

  // Перекрестие и подсказка при наведении
  const focus = g.append("g").style("display", "none");
  focus.append("line").attr("class", "focus-line").attr("y1", 0).attr("y2", innerH);
  focus.append("circle").attr("class", "focus-dot").attr("r", 5);

  const bisect = d3.bisector(d => d.month).center;
  g.append("rect")
    .attr("width", innerW).attr("height", innerH)
    .attr("fill", "transparent")
    .on("mousemove", event => {
      const [mx] = d3.pointer(event);
      const d = data[bisect(data, x.invert(mx))];
      focus.style("display", null);
      focus.select("line").attr("x1", x(d.month)).attr("x2", x(d.month));
      focus.select("circle").attr("cx", x(d.month)).attr("cy", y(d[key]));
      showTooltip(event,
        `<strong>${formatMonth(d.month)}</strong>` +
        `${metric.label}: ${metric.format(d[key])} ${metric.unit === "USD" ? "" : metric.unit}` +
        (key === "price_usd" ? "" : `<br><span class="muted">Цена BTC: ${METRICS.price_usd.format(d.price_usd)}</span>`));
    })
    .on("mouseleave", () => {
      focus.style("display", "none");
      hideTooltip();
    });
}

// ---------- Вспомогательные функции ----------

function showTooltip(event, html) {
  const node = tooltip.html(html).classed("is-visible", true).node();
  const { width, height } = node.getBoundingClientRect();
  let left = event.clientX + 14;
  let top = event.clientY - height - 10;
  if (left + width > window.innerWidth - 8) left = event.clientX - width - 14;
  if (top < 8) top = event.clientY + 16;
  tooltip.style("left", `${left}px`).style("top", `${top}px`);
}

function hideTooltip() {
  tooltip.classed("is-visible", false);
}

function debounce(fn, ms) {
  let t;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}
