document.addEventListener('DOMContentLoaded', function() {
  // Define colors for consistency across charts
  const colors = {
    oyl: '#4e79a7',
    ordiscan: '#f28e2c',
    other_clock_in: '#e15759',
    non_clock_in: '#999999'  // Changed to gray
  };
  // Fetch market share data
  fetch('/api/market-share-data')
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        renderVisualization(result.data);
        populateTable(result.data.blockData);
      } else {
        showError(result.error || 'An error occurred while fetching data');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showError('Failed to fetch data. Please try again later.');
    });
  
  function renderVisualization(data) {
    const { blockData, globalMaxCount } = data;
    
    // Hide loading indicator and show visualization container
    document.getElementById('loading').style.display = 'none';
    document.getElementById('visualization-container').style.display = 'block';
    
    // Clear previous visualization
    const container = d3.select('#block-visualization');
    container.html('');
    
    // Set up SVG dimensions to use full width
    const margin = { top: 50, right: 150, bottom: 80, left: 80 };
    const containerWidth = document.getElementById('block-visualization').clientWidth;
    const width = containerWidth - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;
    
    // Create SVG container
    const svg = container.append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create X scale for block heights
    const x = d3.scaleBand()
      .domain(blockData.map(d => d.blockHeight))
      .range([0, width])
      .padding(0.2);
    
    // Create Y scale for transaction count
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(blockData, d => d.totalTxCount)])
      .range([height, 0]);
    
    // Create tooltip
    const tooltip = d3.select("#visualization-container")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background-color", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("padding", "8px")
      .style("pointer-events", "none");

    // Function to show tooltip
    const showTooltip = (event, d, i, category) => {
      const categoryMap = {
        oyl: 'Oyl Corp',
        ordiscan: 'Ordiscan',
        other_clock_in: 'Other Clock-In',
        non_clock_in: 'Non Clock-In'
      };
      
      const count = d.data[category];
      let percentage;
      
      if (category === 'non_clock_in') {
        percentage = d.data.nonClockInPercentage;
      } else {
        // For clock-in categories, show percentage within clock-ins
        percentage = category === 'oyl' ? d.data.oylPercentage : 
                    category === 'ordiscan' ? d.data.ordiscanPercentage : 
                    d.data.otherClockInPercentage;
      }
      
      tooltip.transition()
        .duration(200)
        .style("opacity", 0.9);
      tooltip.html(`
        <strong>Block Height:</strong> ${d.data.blockHeight}<br/>
        <strong>Category:</strong> ${categoryMap[category]}<br/>
        <strong>Count:</strong> ${count}<br/>
        <strong>Percentage:</strong> ${percentage.toFixed(2)}%
      `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    };

    // Prepare data for stacked bar chart
    const stackedData = blockData.map(d => {
      return {
        blockHeight: d.blockHeight,
        oyl: d.oylCount,
        ordiscan: d.ordiscanCount,
        other_clock_in: d.otherClockInCount,
        non_clock_in: d.nonClockInCount,
        total_clock_in: d.totalClockInCount,
        total_tx: d.totalTxCount,
        oylPercentage: d.oylPercentage,
        ordiscanPercentage: d.ordiscanPercentage,
        otherClockInPercentage: d.otherClockInPercentage,
        clockInPercentage: d.clockInPercentage,
        nonClockInPercentage: d.nonClockInPercentage
      };
    });

    // Using the colors defined at the top level for consistency across charts

    // Process data for stacking
    stackedData.forEach((d, i) => {
      // Draw the stacked bar
      const categories = ['oyl', 'ordiscan', 'other_clock_in', 'non_clock_in'];
      let currentHeight = 0;
      
      categories.forEach(category => {
        const count = d[category];
        
        if (count > 0) {
          svg.append('rect')
            .attr('x', x(d.blockHeight))
            .attr('y', yScale(currentHeight + count))
            .attr('width', x.bandwidth())
            .attr('height', yScale(currentHeight) - yScale(currentHeight + count))
            .attr('fill', colors[category])
            .attr('opacity', 0.9)
            .attr('stroke', '#333')
            .attr('stroke-width', 0.5)
            .on('mouseover', event => showTooltip(event, { data: d }, i, category))
            .on('mouseout', () => {
              tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            });
          
          // Add data label to each segment if count is significant enough
          if (count > d.total_tx * 0.05) { // Only show label if segment is at least 5% of total
            svg.append('text')
              .attr('x', x(d.blockHeight) + x.bandwidth() / 2)
              .attr('y', height - currentHeight + count / 2)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .attr('fill', 'white')
              .attr('font-size', '10px')
              .attr('font-weight', 'bold')
              .text(count);
          }
        
        currentHeight += count;
      }
    });
      
      // Add total count above the bar
      svg.append('text')
        .attr('x', x(d.blockHeight) + x.bandwidth() / 2)
        .attr('y', yScale(d.total_tx) - 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .text(d.total_tx);
    });

    // Add X axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');

    // Add Y axis
    svg.append('g')
      .call(d3.axisLeft(yScale));

    // Add X axis label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 10)
      .text('Block Height');

    // Add Y axis label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 20)
      .attr('x', -height / 2)
      .text('Transaction Count');

    // Add title
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', -20)
      .attr('font-size', '20px')
      .attr('font-weight', 'bold')
      .text('ClockInSystem Service Providers Market Penetration');

    // Add legend
    const legendItems = [
      { key: 'oyl', label: 'Oyl Corp' },
      { key: 'ordiscan', label: 'Ordiscan' },
      { key: 'other_clock_in', label: 'Other Clock-In' },
      { key: 'non_clock_in', label: 'Non Clock-In' }
    ];

    const legend = svg.append('g')
      .attr('transform', `translate(${width + 20}, 20)`);

    // Add background rectangle for legend
    legend.append('rect')
      .attr('width', 140)
      .attr('height', 100)
      .attr('fill', 'white')
      .attr('stroke', 'none')
      .attr('rx', 5)  // Rounded corners
      .attr('ry', 5);

    // Add legend title
    legend.append('text')
      .attr('x', 10)
      .attr('y', 20)
      .attr('font-weight', 'bold')
      .text('Legend');

    // Add legend items
    legendItems.forEach((item, i) => {
      const legendGroup = legend.append('g')
        .attr('transform', `translate(10, ${i * 20 + 30})`);

      legendGroup.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', colors[item.key])
        .attr('stroke', '#333')
        .attr('stroke-width', 0.5);

      legendGroup.append('text')
        .attr('x', 25)
        .attr('y', 12)
        .attr('font-size', '12px')
        .text(item.label);
    });
    
    // Render the second chart (Clock-In Only)
    renderClockInOnlyChart(blockData);
    
    // Render the third chart (OYL vs Ordiscan Only)
    renderOylOrdiscanChart(blockData);
  }
  
  function renderClockInOnlyChart(blockData) {
    // Clear previous visualization
    const container = d3.select('#clock-in-visualization');
    container.html('');
    
    // Set up SVG dimensions
    const margin = { top: 50, right: 150, bottom: 80, left: 80 };
    const containerWidth = document.getElementById('clock-in-visualization').clientWidth;
    const width = containerWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    
    // Create SVG container
    const svg = container.append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create X scale for block heights
    const x = d3.scaleBand()
      .domain(blockData.map(d => d.blockHeight))
      .range([0, width])
      .padding(0.2);
    
    // Create Y scale for clock-in transaction count only
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(blockData, d => d.totalClockInCount)])
      .range([height, 0]);
    
    // Create tooltip
    const tooltip = d3.select("#clock-in-visualization")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background-color", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("padding", "8px")
      .style("pointer-events", "none");
    
    // Function to show tooltip
    const showTooltip = (event, d, i, category) => {
      const categoryMap = {
        oyl: 'Oyl Corp',
        ordiscan: 'Ordiscan',
        other_clock_in: 'Other Clock-In'
      };
      
      const count = d.data[category];
      let percentage;
      
      // For clock-in categories, show percentage within clock-ins only
      if (category === 'oyl') {
        percentage = (count / d.data.total_clock_in) * 100;
      } else if (category === 'ordiscan') {
        percentage = (count / d.data.total_clock_in) * 100;
      } else {
        percentage = (count / d.data.total_clock_in) * 100;
      }
      
      tooltip.transition()
        .duration(200)
        .style("opacity", 0.9);
      tooltip.html(`
        <strong>Block Height:</strong> ${d.data.blockHeight}<br/>
        <strong>Category:</strong> ${categoryMap[category]}<br/>
        <strong>Count:</strong> ${count}<br/>
        <strong>Percentage of Clock-Ins:</strong> ${percentage.toFixed(2)}%
      `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    };
    
    // Prepare data for stacked bar chart (clock-in only)
    const clockInStackedData = blockData.map(d => {
      return {
        blockHeight: d.blockHeight,
        oyl: d.oylCount,
        ordiscan: d.ordiscanCount,
        other_clock_in: d.otherClockInCount,
        total_clock_in: d.totalClockInCount
      };
    });
    
    // Draw stacked bars for clock-in data only
    clockInStackedData.forEach((d, i) => {
      let currentHeight = 0;
      
      // Draw segments only for clock-in categories
      ['oyl', 'ordiscan', 'other_clock_in'].forEach(category => {
        const count = d[category];
        
        if (count > 0) {
          svg.append('rect')
            .attr('x', x(d.blockHeight))
            .attr('y', yScale(currentHeight + count))
            .attr('width', x.bandwidth())
            .attr('height', height - yScale(count))
            .attr('fill', colors[category])
            .attr('stroke', '#333')
            .attr('stroke-width', 0.5)
            .on('mouseover', event => showTooltip(event, { data: d }, i, category))
            .on('mouseout', () => {
              tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            });
            
          // Add data label to each segment if count is significant enough
          if (count > d.total_clock_in * 0.05) { // Only show label if segment is at least 5% of total
            svg.append('text')
              .attr('x', x(d.blockHeight) + x.bandwidth() / 2)
              .attr('y', yScale(currentHeight + count / 2))
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .attr('fill', 'white')
              .attr('font-size', '10px')
              .attr('font-weight', 'bold')
              .text(count);
          }
          
          currentHeight += count;
        }
      });
      
      // Add total count above the bar
      svg.append('text')
        .attr('x', x(d.blockHeight) + x.bandwidth() / 2)
        .attr('y', yScale(d.total_clock_in) - 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .text(d.total_clock_in);
    });
    
    // Add X axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');
    
    // Add Y axis
    svg.append('g')
      .call(d3.axisLeft(yScale));
    
    // Add X axis label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 10)
      .text('Block Height');
    
    // Add Y axis label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 20)
      .attr('x', -height / 2)
      .text('Clock-In Transaction Count');
    
    // Add title
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', -20)
      .attr('font-size', '20px')
      .attr('font-weight', 'bold')
      .text('ClockInSystem Service Providers Market Penetration');
    
    // Add legend
    const legendItems = [
      { key: 'oyl', label: 'Oyl Corp' },
      { key: 'ordiscan', label: 'Ordiscan' },
      { key: 'other_clock_in', label: 'Other Clock-In' }
    ];
    
    const legend = svg.append('g')
      .attr('transform', `translate(${width + 20}, 20)`);
    
    // Add background rectangle for legend
    legend.append('rect')
      .attr('width', 140)
      .attr('height', 80)
      .attr('fill', 'white')
      .attr('stroke', 'none')
      .attr('rx', 5)  // Rounded corners
      .attr('ry', 5);
    
    // Add legend title
    legend.append('text')
      .attr('x', 10)
      .attr('y', 20)
      .attr('font-weight', 'bold')
      .text('Legend');
    
    // Add legend items
    legendItems.forEach((item, i) => {
      const legendGroup = legend.append('g')
        .attr('transform', `translate(10, ${i * 20 + 30})`);
      
      legendGroup.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', colors[item.key])
        .attr('stroke', '#333')
        .attr('stroke-width', 0.5);
      
      legendGroup.append('text')
        .attr('x', 25)
        .attr('y', 12)
        .attr('font-size', '12px')
        .text(item.label);
    });
  }

  function renderOylOrdiscanChart(blockData) {
    // Clear previous visualization
    const container = d3.select('#oyl-ordiscan-visualization');
    container.html('');
    
    // Set up SVG dimensions
    const margin = { top: 50, right: 150, bottom: 80, left: 80 };
    const containerWidth = document.getElementById('oyl-ordiscan-visualization').clientWidth;
    const width = containerWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    
    // Create SVG container
    const svg = container.append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create X scale for block heights
    const x = d3.scaleBand()
      .domain(blockData.map(d => d.blockHeight))
      .range([0, width])
      .padding(0.2);
    
    // Prepare data for OYL vs Ordiscan comparison
    const oylOrdiscanData = blockData.map(d => {
      const oylCount = d.oylCount;
      const ordiscanCount = d.ordiscanCount;
      const total = oylCount + ordiscanCount;
      
      // Calculate percentages on the fly
      const oylPercentage = total > 0 ? (oylCount / total) * 100 : 0;
      const ordiscanPercentage = total > 0 ? (ordiscanCount / total) * 100 : 0;
      
      return {
        blockHeight: d.blockHeight,
        oyl: oylCount,
        ordiscan: ordiscanCount,
        total: total,
        oylPercentage: oylPercentage,
        ordiscanPercentage: ordiscanPercentage
      };
    });
    
    // Create Y scale for transaction count
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(oylOrdiscanData, d => d.total)])
      .range([height, 0]);
    
    // Create tooltip
    const tooltip = d3.select("#oyl-ordiscan-visualization")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background-color", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("padding", "8px")
      .style("pointer-events", "none");
    
    // Function to show tooltip
    const showTooltip = (event, d, i, category) => {
      const categoryMap = {
        oyl: 'Oyl Corp',
        ordiscan: 'Ordiscan'
      };
      
      const count = d.data[category];
      const percentage = category === 'oyl' ? d.data.oylPercentage : d.data.ordiscanPercentage;
      
      tooltip.transition()
        .duration(200)
        .style("opacity", 0.9);
      tooltip.html(`
        <strong>Block Height:</strong> ${d.data.blockHeight}<br/>
        <strong>Category:</strong> ${categoryMap[category]}<br/>
        <strong>Count:</strong> ${count}<br/>
        <strong>Percentage of OYL+Ordiscan:</strong> ${percentage.toFixed(2)}%
      `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    };
    
    // Draw stacked bars for OYL and Ordiscan data only
    oylOrdiscanData.forEach((d, i) => {
      let currentHeight = 0;
      
      // Draw segments only for OYL and Ordiscan categories
      ['oyl', 'ordiscan'].forEach(category => {
        const count = d[category];
        
        if (count > 0) {
          svg.append('rect')
            .attr('x', x(d.blockHeight))
            .attr('y', yScale(currentHeight + count))
            .attr('width', x.bandwidth())
            .attr('height', height - yScale(count))
            .attr('fill', colors[category])
            .attr('stroke', '#333')
            .attr('stroke-width', 0.5)
            .on('mouseover', event => showTooltip(event, { data: d }, i, category))
            .on('mouseout', () => {
              tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            });
            
          // Add data label with count and percentage to each segment
          if (count > d.total * 0.05) { // Only show label if segment is at least 5% of total
            const percentage = category === 'oyl' ? d.oylPercentage : d.ordiscanPercentage;
            svg.append('text')
              .attr('x', x(d.blockHeight) + x.bandwidth() / 2)
              .attr('y', yScale(currentHeight + count / 2))
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .attr('fill', 'white')
              .attr('font-size', '10px')
              .attr('font-weight', 'bold')
              .text(`${count} (${percentage.toFixed(0)}%)`);
          }
          
          currentHeight += count;
        }
      });
      
      // Add total count above the bar
      svg.append('text')
        .attr('x', x(d.blockHeight) + x.bandwidth() / 2)
        .attr('y', yScale(d.total) - 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .text(d.total);
    });
    
    // Add X axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');
    
    // Add Y axis
    svg.append('g')
      .call(d3.axisLeft(yScale));
    
    // Add X axis label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 10)
      .text('Block Height');
    
    // Add Y axis label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 20)
      .attr('x', -height / 2)
      .text('Transaction Count');
    
    // Add title
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', -20)
      .attr('font-size', '20px')
      .attr('font-weight', 'bold')
      .text('ClockInSystem Service Providers Market Share');
    
    // Add legend
    const legendItems = [
      { key: 'oyl', label: 'Oyl Corp' },
      { key: 'ordiscan', label: 'Ordiscan' }
    ];
    
    const legend = svg.append('g')
      .attr('transform', `translate(${width + 20}, 20)`);
    
    // Add background rectangle for legend
    legend.append('rect')
      .attr('width', 140)
      .attr('height', 60)
      .attr('fill', 'white')
      .attr('stroke', 'none')
      .attr('rx', 5)  // Rounded corners
      .attr('ry', 5);
    
    // Add legend title
    legend.append('text')
      .attr('x', 10)
      .attr('y', 20)
      .attr('font-weight', 'bold')
      .text('Legend');
    
    // Add legend items
    legendItems.forEach((item, i) => {
      const legendGroup = legend.append('g')
        .attr('transform', `translate(10, ${i * 20 + 30})`);
      
      legendGroup.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', colors[item.key])
        .attr('stroke', '#333')
        .attr('stroke-width', 0.5);
      
      legendGroup.append('text')
        .attr('x', 25)
        .attr('y', 12)
        .attr('font-size', '12px')
        .text(item.label);
    });
  }

  function populateTable(data) {
    const tableBody = document.querySelector('#data-table tbody');
    tableBody.innerHTML = '';

    data.forEach(d => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${d.blockHeight}</td>
        <td>${d.totalTxCount}</td>
        <td>${d.totalClockInCount}</td>
        <td>${d.clockInPercentage.toFixed(2)}%</td>
        <td>${d.oylCount}</td>
        <td>${d.oylPercentage.toFixed(2)}%</td>
        <td>${d.ordiscanCount}</td>
        <td>${d.ordiscanPercentage.toFixed(2)}%</td>
        <td>${d.otherClockInCount}</td>
        <td>${d.otherClockInPercentage.toFixed(2)}%</td>
        <td>${d.nonClockInCount}</td>
        <td>${d.nonClockInPercentage.toFixed(2)}%</td>
      `;
      tableBody.appendChild(row);
    });
  }

  function showError(message) {
    document.getElementById('loading').style.display = 'none';

    const container = document.getElementById('visualization-container');
    container.style.display = 'block';
    container.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <h4 class="alert-heading">Error</h4>
        <p>${message}</p>
      </div>
    `;
  }
});
